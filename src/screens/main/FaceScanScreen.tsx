/**
 * FaceScanScreen.tsx
 *
 * 4-state screen:
 *   capture  → full-screen camera with oval SVG overlay
 *   preview  → review photo before sending
 *   loading  → animated scan line + cycling text while the API call runs
 *   results  → rich skin analysis card (skin type chip, concerns, advice, SPF note, disclaimer)
 *
 * API call uses fetch() directly against the Firebase callable-function HTTPS
 * endpoint instead of the @react-native-firebase/functions SDK.  The native
 * Android module for that SDK is currently disabled (see react-native.config.js
 * — Windows MAX_PATH issue), so a raw authenticated fetch is the reliable path.
 * The Firebase callable protocol is identical: POST { data: {...} } with a
 * Bearer token, response is { result: {...} } or { error: {...} }.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import type { PhotoFile } from 'react-native-vision-camera';
import { CompositeNavigationProp, useIsFocused } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import { launchImageLibrary } from 'react-native-image-picker';
import Svg, { Ellipse, Path } from 'react-native-svg';
import RNFS from 'react-native-fs';
import auth from '@react-native-firebase/auth';
import Toast from 'react-native-toast-message';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatDistanceToNow } from 'date-fns';

import { COLORS } from '../../constants/theme';
import { useSkinAnalysisStore } from '../../store/skinAnalysisStore';
import { useSkinProfileStore } from '../../store/skinProfileStore';
import {
  saveLastScanLocally,
  loadLastScanLocally,
  loadLastScanFromFirestore,
  clearLastScan,
} from '../../services/scanPersistenceService';
import type {
  FaceScanStackParamList,
  MainTabParamList,
  RootStackParamList,
  SkinAnalysisResult,
  SkinConcern,
  SkinType,
} from '../../types';

// Extends SkinAnalysisResult with timestamps added by the persistence layer
type CachedScanResult = SkinAnalysisResult & {
  cachedAt?: string;   // ISO string — set by saveLastScanLocally
  scannedAt?: { _seconds: number; _nanoseconds: number } | null; // Firestore Timestamp
};

function resolveScanDate(r: CachedScanResult): Date {
  if (r.cachedAt) return new Date(r.cachedAt);
  if (r.scannedAt && typeof r.scannedAt === 'object' && '_seconds' in r.scannedAt) {
    return new Date(r.scannedAt._seconds * 1000);
  }
  return new Date();
}

// ─── Config ───────────────────────────────────────────────────────────────────

// Gen 2 callable functions run on Cloud Run — URL format is different from Gen 1.
// Project number (not ID) is used: found in android/app/google-services.json → project_number
const FN_URL = 'https://analyseskine-213529858076.asia-south1.run.app';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: W, height: H } = Dimensions.get('window');

const OVL_CX = W / 2;
const OVL_CY = H * 0.45;
const OVL_RX = W * 0.38;
const OVL_RY = H * 0.48;

const LOADING_TEXTS = [
  'Detecting skin type...',
  'Analysing concerns...',
  'Finding your products...',
  'Almost ready...',
];

const CONCERN_LABELS: Record<SkinConcern, string> = {
  acne: 'Acne',
  pigmentation: 'Pigmentation',
  dehydration: 'Dehydration',
  dark_circles: 'Dark Circles',
  redness: 'Redness',
  fine_lines: 'Fine Lines',
  uneven_texture: 'Uneven Texture',
  enlarged_pores: 'Enlarged Pores',
};

const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  oily: 'Oily Skin',
  dry: 'Dry Skin',
  combination: 'Combination Skin',
  sensitive: 'Sensitive Skin',
  normal: 'Normal Skin',
};

// ─── SVG oval overlay ─────────────────────────────────────────────────────────

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const K = 0.5522847498;
  const kx = rx * K;
  const ky = ry * K;
  const [x0, x1, y0, y1] = [cx - rx, cx + rx, cy - ry, cy + ry];
  return [
    `M ${cx} ${y0}`,
    `C ${cx + kx} ${y0} ${x1} ${cy - ky} ${x1} ${cy}`,
    `C ${x1} ${cy + ky} ${cx + kx} ${y1} ${cx} ${y1}`,
    `C ${cx - kx} ${y1} ${x0} ${cy + ky} ${x0} ${cy}`,
    `C ${x0} ${cy - ky} ${cx - kx} ${y0} ${cx} ${y0}`,
    'Z',
  ].join(' ');
}

const OVERLAY_PATH =
  `M 0 0 H ${W} V ${H} H 0 Z ` + ellipsePath(OVL_CX, OVL_CY, OVL_RX, OVL_RY);

function OvalOverlay() {
  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path fillRule="evenodd" d={OVERLAY_PATH} fill="rgba(0,0,0,0.55)" />
      {/* Outer glow ring */}
      <Ellipse
        cx={OVL_CX}
        cy={OVL_CY}
        rx={OVL_RX + 8}
        ry={OVL_RY + 8}
        stroke="rgba(196,181,253,0.3)"
        strokeWidth={1}
        fill="none"
      />
      {/* Inner guide ellipse */}
      <Ellipse
        cx={OVL_CX}
        cy={OVL_CY}
        rx={OVL_RX}
        ry={OVL_RY}
        stroke="#C4B5FD"
        strokeWidth={2.5}
        fill="none"
      />
    </Svg>
  );
}

// ─── Image helpers ────────────────────────────────────────────────────────────

/**
 * Downsample a base64 JPEG to at most maxBytes by stripping every nth byte
 * in a lossless-friendly way — not true re-encoding, but enough to prevent
 * Cloud Run from choking on multi-megabyte payloads.
 *
 * For real quality control we rely on react-native-vision-camera's
 * qualityPrioritization:'speed' which already produces smaller files.
 * This guard is a second safety net for gallery picks.
 */
const MAX_BASE64_BYTES = 3 * 1024 * 1024; // 3 MB → ~2.25 MB original

async function compressIfNeeded(
  filePath: string,         // absolute path without file:// prefix
): Promise<string> {
  const stat = await RNFS.stat(filePath);
  const fileSize = typeof stat.size === 'number' ? stat.size : parseInt(String(stat.size), 10);

  if (fileSize <= MAX_BASE64_BYTES) {
    // Small enough — read as-is
    return RNFS.readFile(filePath, 'base64');
  }

  // File is large — try to read a scaled JPEG via react-native-image-picker
  // manipulation. Fall back to reading raw if that fails.
  try {
    const { launchCamera: _lc, ...picker } = require('react-native-image-picker');
    const result: { assets?: Array<{ base64?: string }> } =
      await new Promise(resolve =>
        picker.launchImageLibrary(
          {
            mediaType: 'photo',
            includeBase64: true,
            quality: 0.4,
            maxWidth: 1024,
            maxHeight: 1024,
            selectionLimit: 1,
            // Override asset — we supply the path ourselves
            assetRepresentationMode: 'compatible',
          } as any,
          resolve,
        ),
      );
    const b64 = result?.assets?.[0]?.base64;
    if (b64) return b64;
  } catch {
    /* fall through to raw read */
  }

  // Last resort: just read the full file and let the server handle it
  return RNFS.readFile(filePath, 'base64');
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function callAnalyseSkine(imageBase64: string): Promise<SkinAnalysisResult> {
  const user = auth().currentUser;
  if (!user) throw Object.assign(new Error('Not authenticated'), { code: 'unauthenticated' });

  const idToken = await user.getIdToken(/* forceRefresh */ true);

  let response: Response;
  try {
    response = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data: { imageBase64 } }),
    });
  } catch (networkErr: unknown) {
    throw Object.assign(
      new Error('Network error — check your internet connection and try again.'),
      { code: 'network-error' },
    );
  }

  // Read raw text first — avoids crashing on HTML error pages or empty bodies
  const rawText = await response.text();

  let json: { result: SkinAnalysisResult } | { error: { status: string; message: string } };
  try {
    json = JSON.parse(rawText);
  } catch {
    // Server returned non-JSON (HTML error page, empty body, etc.)
    console.error(`[FaceScan] Non-JSON response HTTP ${response.status}:`, rawText.slice(0, 400));
    throw Object.assign(
      new Error(
        response.status === 408 || response.status === 504
          ? 'Analysis timed out — please try again with better lighting.'
          : `Server error (${response.status}). Please try again in a moment.`,
      ),
      { code: 'internal' },
    );
  }

  if ('error' in json) {
    throw Object.assign(new Error(json.error.message), { code: json.error.status });
  }

  if (!json.result) {
    console.error('[FaceScan] Parsed JSON but no result field:', json);
    throw Object.assign(
      new Error('Unexpected response from server. Please try again.'),
      { code: 'internal' },
    );
  }

  return json.result;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type ScreenState = 'checking' | 'capture' | 'preview' | 'loading' | 'results' | 'saved';
type FaceScanNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'ScanTab'>,
  StackNavigationProp<RootStackParamList>
>;

export function FaceScanScreen({ navigation }: { navigation: FaceScanNavProp }) {
  // Camera
  const [cameraPos, setCameraPos] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPos);
  const { hasPermission, requestPermission } = useCameraPermission();
  const isFocused = useIsFocused();
  const cameraRef = useRef<Camera>(null);

  // Screen state — starts at 'checking' so the mount effect can decide
  const [screenState, setScreenState] = useState<ScreenState>('checking');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  // Holds the result loaded from cache/Firestore for the 'saved' state
  const [lastScanResult, setLastScanResult] = useState<CachedScanResult | null>(null);

  // Analysis result — written into Zustand store on success
  const setResult = useSkinAnalysisStore(s => s.setResult);
  const analysisResult = useSkinAnalysisStore(s => s.latestResult);

  // ── Mount: check for a previously saved scan ───────────
  useEffect(() => {
    (async () => {
      try {
        let saved: CachedScanResult | null =
          (await loadLastScanLocally()) as CachedScanResult | null;

        if (!saved) {
          saved = (await loadLastScanFromFirestore()) as CachedScanResult | null;
          // Warm the local cache so the next open is instant
          if (saved?.products?.length) {
            await saveLastScanLocally(saved).catch(() => null);
          }
        }

        if (saved?.products?.length) {
          setLastScanResult(saved);
          setScreenState('saved');
        } else {
          setScreenState('capture');
        }
      } catch {
        setScreenState('capture');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loading animation
  const scanAnim = useRef(new Animated.Value(0)).current;
  const [loadingTextIdx, setLoadingTextIdx] = useState(0);
  const [activeDot, setActiveDot] = useState(0);
  const textIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Pulse animation for guide text in capture state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Shutter press animation
  const shutterScale = useRef(new Animated.Value(1)).current;
  const handleShutterPressIn = () =>
    Animated.spring(shutterScale, { toValue: 0.93, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
  const handleShutterPressOut = () =>
    Animated.spring(shutterScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }).start();

  useEffect(() => {
    if (screenState === 'loading') {
      scanAnim.setValue(0);
      scanLoopRef.current = Animated.loop(
        Animated.timing(scanAnim, { toValue: H, duration: 2500, useNativeDriver: true }),
      );
      scanLoopRef.current.start();

      setLoadingTextIdx(0);
      setActiveDot(0);
      textIntervalRef.current = setInterval(() => {
        setLoadingTextIdx(i => (i + 1) % LOADING_TEXTS.length);
      }, 2000);
      dotIntervalRef.current = setInterval(() => {
        setActiveDot(d => (d + 1) % 3);
      }, 800);
    } else {
      scanLoopRef.current?.stop();
      if (textIntervalRef.current) {
        clearInterval(textIntervalRef.current);
        textIntervalRef.current = null;
      }
      if (dotIntervalRef.current) {
        clearInterval(dotIntervalRef.current);
        dotIntervalRef.current = null;
      }
    }
    return () => {
      if (textIntervalRef.current) clearInterval(textIntervalRef.current);
      if (dotIntervalRef.current) clearInterval(dotIntervalRef.current);
    };
  }, [screenState, scanAnim]);

  // ── Handlers ──────────────────────────────────────────────

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto({
        qualityPrioritization: 'speed', // smaller file size, faster upload
      });
      const filePath = photo.path.startsWith('file://') ? photo.path.slice(7) : photo.path;
      const uri = `file://${filePath}`;
      setCapturedUri(uri);
      setScreenState('preview');
    } catch (e) {
      console.warn('takePhoto error', e);
    }
  }, []);

  const handleGallery = useCallback(() => {
    launchImageLibrary({ mediaType: 'photo' }, response => {
      if (response.didCancel || response.errorCode) return;
      const asset = response.assets?.[0];
      if (!asset?.uri) return;
      setCapturedUri(asset.uri);
      setScreenState('preview');
    });
  }, []);

  const handleFlip = useCallback(() => {
    setCameraPos(p => (p === 'front' ? 'back' : 'front'));
  }, []);

  const handleAnalyse = useCallback(async () => {
    if (!capturedUri) return;
    setScreenState('loading');

    try {
      // Read + compress image to base64 (guards against large camera files)
      const fsPath = capturedUri.startsWith('file://')
        ? capturedUri.slice(7)
        : capturedUri;
      const imageBase64 = await compressIfNeeded(fsPath);

      // Call Cloud Function
      const result = await callAnalyseSkine(imageBase64);

      // Persist in Zustand — skinAnalysisStore (in-session) + skinProfileStore (persistent)
      setResult(result);
      const ps = useSkinProfileStore.getState();
      ps.setSkinProfile({
        skinType: result.skinType,
        concerns: result.concerns,
        advice: result.advice,
        scanId: result.scanId ?? Date.now().toString(),
        scannedAt: null,
      });
      ps.setRecommendations(result.products);
      ps.setProfileLoaded(true);

      // Persist locally for next app open (Part D)
      await saveLastScanLocally(result);

      setScreenState('results');
    } catch (err: unknown) {
      setScreenState('preview'); // revert so user can retry

      const code: string = (err as { code?: string }).code ?? '';
      const message: string = (err as { message?: string }).message ?? 'Something went wrong.';

      if (code === 'RESOURCE_EXHAUSTED' || code === 'resource-exhausted') {
        Toast.show({
          type: 'info',
          text1: 'Daily limit reached',
          text2: 'You can scan up to 3 times per day. Try again tomorrow.',
          visibilityTime: 4000,
        });
      } else {
        Alert.alert('Analysis failed', message, [{ text: 'OK' }]);
      }
    }
  }, [capturedUri, setResult]);

  const handleRetake = useCallback(() => {
    setCapturedUri(null);
    setScreenState('capture');
  }, []);

  const handleViewProducts = useCallback(() => {
    if (!analysisResult) return;

    navigation.navigate('RecommendationsScreen', {
      products: analysisResult.products,
      skinType: analysisResult.skinType,
      scanId: analysisResult.scanId ?? Date.now().toString(),
    });
  }, [navigation, analysisResult]);

  const handleViewSavedProducts = useCallback(() => {
    if (!lastScanResult) return;
    navigation.navigate('RecommendationsScreen', {
      products: lastScanResult.products,
      skinType: lastScanResult.skinType,
      scanId: lastScanResult.scanId ?? '',
    });
  }, [navigation, lastScanResult]);

  const handleRescan = useCallback(() => {
    Alert.alert(
      'Re-scan your face?',
      'This will replace your current skin analysis with a new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-scan',
          style: 'destructive',
          onPress: async () => {
            await clearLastScan();
            setLastScanResult(null);
            setScreenState('capture');
          },
        },
      ],
    );
  }, []);

  // ── Permission gate ────────────────────────────────────────

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.centredPage}>
        <MaterialCommunityIcons name="camera-off" size={72} color="#9CA3AF" />
        <Text style={styles.pageTitle}>Camera Access Required</Text>
        <Text style={styles.pageBody}>
          Allow camera access so we can scan your face and analyse your skin.
        </Text>
        <TouchableOpacity style={styles.tealBtn} onPress={requestPermission}>
          <Text style={styles.tealBtnText}>Allow Camera Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── STATE: checking ────────────────────────────────────────

  if (screenState === 'checking') {
    return (
      <View style={styles.checkingPage}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.checkingText}>Loading your skin profile...</Text>
      </View>
    );
  }

  // ── STATE: capture ─────────────────────────────────────────

  if (screenState === 'capture') {
    return (
      <View style={styles.fullScreen}>
        {device ? (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused}
            photo
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noCamera]}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        )}

        <OvalOverlay />

        {/* Guide text — pulsing */}
        <View style={styles.guideWrapper} pointerEvents="none">
          <Animated.View style={{ opacity: pulseAnim }}>
            <Text style={styles.guideText}>Position your face in the oval</Text>
            <Text style={styles.guideSubText}>Use natural lighting for best results</Text>
          </Animated.View>
        </View>

        {/* Flip camera — top right */}
        <SafeAreaView style={styles.flipWrapper}>
          <TouchableOpacity style={styles.iconCircleBtn} onPress={handleFlip}>
            <MaterialCommunityIcons name="camera-flip-outline" size={26} color="white" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Capture bar */}
        <SafeAreaView style={styles.captureBar}>
          {/* Left spacer */}
          <View style={{ width: 72 }} />

          {/* Shutter */}
          <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
            <TouchableOpacity
              style={styles.shutterOuter}
              onPress={handleTakePhoto}
              onPressIn={handleShutterPressIn}
              onPressOut={handleShutterPressOut}
              activeOpacity={1}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          </Animated.View>

          {/* Right spacer */}
          <View style={{ width: 72 }} />
        </SafeAreaView>

        {/* Choose from gallery — centered below capture bar */}
        <SafeAreaView style={styles.galleryTextWrapper} pointerEvents="box-none">
          <TouchableOpacity onPress={handleGallery}>
            <Text style={styles.galleryText}>Choose from gallery</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── STATE: preview ─────────────────────────────────────────

  if (screenState === 'preview' && capturedUri) {
    return (
      <View style={styles.fullScreen}>
        <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

        {/* Dark gradient overlay at bottom */}
        <View style={styles.previewDimOverlay} pointerEvents="none" />

        <SafeAreaView style={styles.previewTopBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleRetake}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
        </SafeAreaView>

        <SafeAreaView style={styles.previewBottom}>
          <Text style={styles.previewHeading}>Analyse your skin?</Text>
          <Text style={styles.privacyNote}>
            Your photo is analysed securely and never stored
          </Text>
          <View style={styles.previewBtnRow}>
            <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake}>
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.analyseBtn} onPress={handleAnalyse}>
              <Text style={styles.analyseBtnText}>Analyse my skin</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── STATE: loading ─────────────────────────────────────────

  if (screenState === 'loading' && capturedUri) {
    return (
      <View style={styles.fullScreen}>
        <Image
          source={{ uri: capturedUri }}
          style={[StyleSheet.absoluteFill, { opacity: 0.4 }]}
          resizeMode="cover"
        />
        <Animated.View
          style={[styles.scanLine, { transform: [{ translateY: scanAnim }] }]}
        />
        <View style={styles.loadingLabel}>
          <Text style={styles.loadingText}>{LOADING_TEXTS[loadingTextIdx]}</Text>
          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {[0, 1, 2].map(i => (
              <View
                key={i}
                style={[styles.dot, activeDot === i ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>
          <Text style={styles.loadingSubText}>Please keep still</Text>
        </View>
      </View>
    );
  }

  // ── STATE: saved ───────────────────────────────────────────

  if (screenState === 'saved' && lastScanResult) {
    const scanDate = resolveScanDate(lastScanResult);
    return (
      <SafeAreaView style={styles.resultsPage}>
        <ScrollView
          style={styles.resultsScroll}
          contentContainerStyle={styles.resultsContent}
          showsVerticalScrollIndicator={false}>

          {/* ── History banner ── */}
          <View style={styles.savedBanner}>
            <View style={styles.savedBannerIconCircle}>
              <MaterialCommunityIcons name="history" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.savedBannerInfo}>
              <Text style={styles.savedBannerTitle}>Last scan results</Text>
              <Text style={styles.savedBannerSub}>
                Scanned {formatDistanceToNow(scanDate)} ago
              </Text>
            </View>
            <TouchableOpacity style={styles.rescanPill} onPress={handleRescan}>
              <Text style={styles.rescanPillText}>Re-scan</Text>
            </TouchableOpacity>
          </View>

          {/* ── Skin type badge ── */}
          <View style={styles.skinTypePill}>
            <Text style={styles.skinTypePillText}>
              {SKIN_TYPE_LABELS[lastScanResult.skinType]}
            </Text>
          </View>

          {/* ── Concerns ── */}
          {lastScanResult.concerns.length > 0 && (
            <View style={styles.section}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.concernsRow}>
                {lastScanResult.concerns.map(c => (
                  <View key={c} style={styles.concernChip}>
                    <Text style={styles.concernChipText}>{CONCERN_LABELS[c] ?? c}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Advice ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your skincare advice</Text>
            {lastScanResult.advice.map((tip, idx) => (
              <View key={idx} style={styles.adviceCard}>
                <View style={styles.adviceNumCircle}>
                  <Text style={styles.adviceNum}>{idx + 1}</Text>
                </View>
                <Text style={styles.adviceText}>{tip}</Text>
              </View>
            ))}
          </View>

          {/* ── SPF note ── */}
          <View style={styles.spfBox}>
            <MaterialCommunityIcons name="white-balance-sunny" size={18} color="#8B5CF6" />
            <Text style={styles.spfText}>{lastScanResult.spfNote}</Text>
          </View>

          {/* ── CTA ── */}
          <TouchableOpacity style={styles.ctaBtn} onPress={handleViewSavedProducts}>
            <Text style={styles.ctaBtnText}>See product recommendations</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* ── Disclaimer ── */}
          <Text style={styles.disclaimer}>{lastScanResult.disclaimer}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── STATE: results ─────────────────────────────────────────

  if (!analysisResult) {
    // Fallback: shouldn't normally reach here
    return (
      <SafeAreaView style={styles.centredPage}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.resultsPage}>
      <ScrollView
        style={styles.resultsScroll}
        contentContainerStyle={styles.resultsContent}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Text style={styles.resultsHeading}>Skin Analysis Complete</Text>

        {/* ── Skin type badge ── */}
        <View style={styles.skinTypePill}>
          <Text style={styles.skinTypePillText}>
            {SKIN_TYPE_LABELS[analysisResult.skinType]}
          </Text>
        </View>

        {/* ── Concerns ── */}
        {analysisResult.concerns.length > 0 && (
          <View style={styles.section}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.concernsRow}>
              {analysisResult.concerns.map(c => (
                <View key={c} style={styles.concernChip}>
                  <Text style={styles.concernChipText}>{CONCERN_LABELS[c] ?? c}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Advice ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your skincare advice</Text>
          {analysisResult.advice.map((tip, idx) => (
            <View key={idx} style={styles.adviceCard}>
              <View style={styles.adviceNumCircle}>
                <Text style={styles.adviceNum}>{idx + 1}</Text>
              </View>
              <Text style={styles.adviceText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* ── SPF note ── */}
        <View style={styles.spfBox}>
          <MaterialCommunityIcons name="white-balance-sunny" size={18} color="#8B5CF6" />
          <Text style={styles.spfText}>{analysisResult.spfNote}</Text>
        </View>

        {/* ── CTA ── */}
        <TouchableOpacity style={styles.ctaBtn} onPress={handleViewProducts}>
          <Text style={styles.ctaBtnText}>See product recommendations</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        {/* ── Scan again ── */}
        <TouchableOpacity style={styles.rescanBtn} onPress={handleRetake}>
          <Text style={styles.rescanBtnText}>Scan again</Text>
        </TouchableOpacity>

        {/* ── Disclaimer ── */}
        <Text style={styles.disclaimer}>{analysisResult.disclaimer}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Centred page (permission / fallback) ──
  centredPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 32,
    gap: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  pageBody: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── No camera ──
  noCamera: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },

  // ── Guide text ──
  guideWrapper: {
    position: 'absolute',
    bottom: '15%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  guideText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  guideSubText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },

  // ── Flip button ──
  flipWrapper: {
    position: 'absolute',
    top: 0,
    right: 16,
  },
  iconCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginTop: Platform.OS === 'android' ? 12 : 0,
  },

  // ── Capture bar ──
  captureBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 28,
    paddingTop: 16,
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
  },

  // "Choose from gallery" text
  galleryTextWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 10,
  },
  galleryText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 14,
    textDecorationLine: 'underline',
  },

  // ── Preview ──
  previewDimOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  previewTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  iconBtn: {
    padding: 16,
  },
  previewBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
  },
  previewHeading: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  privacyNote: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  previewBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    height: 50,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeBtnText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    fontSize: 14,
  },
  analyseBtn: {
    flex: 2,
    height: 50,
    borderRadius: 13,
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyseBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Loading ──
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#8B5CF6',
    opacity: 0.9,
    elevation: 4,
    shadowColor: '#8B5CF6',
  },
  loadingLabel: {
    position: 'absolute',
    bottom: '18%',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    borderRadius: 5,
  },
  dotActive: {
    width: 10,
    height: 10,
    backgroundColor: '#8B5CF6',
  },
  dotInactive: {
    width: 7,
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  loadingSubText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },

  // ── Results ──
  resultsPage: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  resultsHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Skin type badge
  skinTypePill: {
    alignSelf: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  skinTypePillText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },

  // Sections
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },

  // Concern chips
  concernsRow: {
    gap: 8,
    flexDirection: 'row',
    paddingRight: 4,
  },
  concernChip: {
    backgroundColor: '#EDE9FE',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  concernChipText: {
    color: '#6D28D9',
    fontSize: 12,
    fontWeight: '500',
  },

  // Advice cards
  adviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
    borderWidth: 0.5,
    borderColor: '#E9E4FF',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  adviceNumCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  adviceNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  adviceText: {
    flex: 1,
    fontSize: 13,
    color: '#2E1065',
    lineHeight: 20,
  },

  // SPF note
  spfBox: {
    flexDirection: 'row',
    backgroundColor: '#F5F3FF',
    borderWidth: 0.5,
    borderColor: '#C4B5FD',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  spfText: {
    flex: 1,
    fontSize: 12,
    color: '#6D28D9',
    lineHeight: 18,
  },

  // CTA button
  ctaBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Scan again / disclaimer
  rescanBtn: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  rescanBtnText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  disclaimer: {
    fontSize: 11,
    color: '#A78BFA',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
  },

  // ── Checking state ──
  checkingPage: {
    flex: 1,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 12,
  },

  // ── Saved state banner ──
  savedBanner: {
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 12,
    margin: 0,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  savedBannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  savedBannerInfo: {
    flex: 1,
  },
  savedBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6D28D9',
  },
  savedBannerSub: {
    fontSize: 11,
    color: '#A78BFA',
    marginTop: 2,
  },
  rescanPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C4B5FD',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  rescanPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B5CF6',
  },

  // Permission screen button (reusing tealBtn name for compat)
  tealBtn: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  tealBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
