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
import { useIsFocused } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import Svg, { Ellipse, Path } from 'react-native-svg';
import RNFS from 'react-native-fs';
import auth from '@react-native-firebase/auth';
import Toast from 'react-native-toast-message';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useSkinAnalysisStore } from '../../store/skinAnalysisStore';
import type { SkinAnalysisResult, SkinConcern, SkinType } from '../../types';

// ─── Config ───────────────────────────────────────────────────────────────────

// Gen 2 callable functions run on Cloud Run — URL format is different from Gen 1.
// Project number (not ID) is used: found in android/app/google-services.json → project_number
const FN_URL = 'https://analyseskine-213529858076.asia-south1.run.app';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAL = '#1D9E75';
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
      <Ellipse
        cx={OVL_CX}
        cy={OVL_CY}
        rx={OVL_RX}
        ry={OVL_RY}
        stroke="white"
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function callAnalyseSkine(imageBase64: string): Promise<SkinAnalysisResult> {
  const user = auth().currentUser;
  if (!user) throw Object.assign(new Error('Not authenticated'), { code: 'unauthenticated' });

  const idToken = await user.getIdToken();

  const response = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: { imageBase64 } }),
  });

  const json = (await response.json()) as
    | { result: SkinAnalysisResult }
    | { error: { status: string; message: string } };

  if ('error' in json) {
    throw Object.assign(new Error(json.error.message), { code: json.error.status });
  }

  return json.result;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type ScreenState = 'capture' | 'preview' | 'loading' | 'results';

export function FaceScanScreen({ navigation }: { navigation: any }) {
  // Camera
  const [cameraPos, setCameraPos] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPos);
  const { hasPermission, requestPermission } = useCameraPermission();
  const isFocused = useIsFocused();
  const cameraRef = useRef<Camera>(null);

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('capture');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

  // Analysis result — written into Zustand store on success
  const setResult = useSkinAnalysisStore(s => s.setResult);
  const analysisResult = useSkinAnalysisStore(s => s.latestResult);

  // Loading animation
  const scanAnim = useRef(new Animated.Value(0)).current;
  const [loadingTextIdx, setLoadingTextIdx] = useState(0);
  const textIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (screenState === 'loading') {
      scanAnim.setValue(0);
      scanLoopRef.current = Animated.loop(
        Animated.timing(scanAnim, { toValue: H, duration: 2500, useNativeDriver: true }),
      );
      scanLoopRef.current.start();

      setLoadingTextIdx(0);
      textIntervalRef.current = setInterval(() => {
        setLoadingTextIdx(i => (i + 1) % LOADING_TEXTS.length);
      }, 2000);
    } else {
      scanLoopRef.current?.stop();
      if (textIntervalRef.current) {
        clearInterval(textIntervalRef.current);
        textIntervalRef.current = null;
      }
    }
    return () => {
      if (textIntervalRef.current) clearInterval(textIntervalRef.current);
    };
  }, [screenState, scanAnim]);

  // ── Handlers ──────────────────────────────────────────────

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto();
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
      // Read image as base64
      const fsPath = capturedUri.startsWith('file://')
        ? capturedUri.slice(7)
        : capturedUri;
      const imageBase64 = await RNFS.readFile(fsPath, 'base64');

      // Call Cloud Function
      const result = await callAnalyseSkine(imageBase64);

      // Persist in store for MyProductsScreen
      setResult(result);
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
    // Navigate to MyProducts at the drawer level.
    // The skin analysis result is available via useSkinAnalysisStore in MyProductsScreen.
    navigation.navigate('MyProducts', { skinType: analysisResult?.skinType });
  }, [navigation, analysisResult]);

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
            <ActivityIndicator color={TEAL} size="large" />
          </View>
        )}

        <OvalOverlay />

        <View style={styles.guideWrapper} pointerEvents="none">
          <Text style={styles.guideText}>Position your face in the oval</Text>
        </View>

        {/* Flip camera */}
        <SafeAreaView style={styles.flipWrapper}>
          <TouchableOpacity style={styles.iconCircleBtn} onPress={handleFlip}>
            <MaterialCommunityIcons name="camera-flip-outline" size={26} color="white" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Capture bar */}
        <SafeAreaView style={styles.captureBar}>
          <TouchableOpacity style={styles.galleryBtn} onPress={handleGallery}>
            <MaterialCommunityIcons name="image-outline" size={20} color="white" />
            <Text style={styles.galleryBtnText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shutter} onPress={handleTakePhoto} activeOpacity={0.8}>
            <View style={styles.shutterRing} />
          </TouchableOpacity>

          {/* Balance spacer */}
          <View style={styles.galleryBtn} />
        </SafeAreaView>
      </View>
    );
  }

  // ── STATE: preview ─────────────────────────────────────────

  if (screenState === 'preview' && capturedUri) {
    return (
      <View style={styles.fullScreen}>
        <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

        <SafeAreaView style={styles.previewTopBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleRetake}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
        </SafeAreaView>

        <SafeAreaView style={styles.previewBottom}>
          <Text style={styles.privacyNote}>
            Your photo is analysed securely and never stored
          </Text>
          <View style={styles.previewBtnRow}>
            <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake}>
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.analyseBtn} onPress={handleAnalyse}>
              <Text style={styles.analyseBtnText}>Analyse my skin</Text>
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
          style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
          resizeMode="cover"
        />
        <Animated.View
          style={[styles.scanLine, { transform: [{ translateY: scanAnim }] }]}
        />
        <View style={styles.loadingLabel}>
          <ActivityIndicator color={TEAL} size="small" />
          <Text style={styles.loadingText}>{LOADING_TEXTS[loadingTextIdx]}</Text>
        </View>
      </View>
    );
  }

  // ── STATE: results ─────────────────────────────────────────

  if (!analysisResult) {
    // Fallback: shouldn't normally reach here
    return (
      <SafeAreaView style={styles.centredPage}>
        <ActivityIndicator color={TEAL} size="large" />
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

        {/* ── Skin type pill ── */}
        <View style={styles.skinTypePill}>
          <Text style={styles.skinTypePillText}>
            {SKIN_TYPE_LABELS[analysisResult.skinType]}
          </Text>
        </View>

        {/* ── Concerns ── */}
        {analysisResult.concerns.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Concerns</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.concernsRow}>
              {analysisResult.concerns.map(c => (
                <View key={c} style={styles.concernChip}>
                  <Text style={styles.concernChipText}>
                    {CONCERN_LABELS[c] ?? c}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Advice ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Skincare Advice</Text>
          {analysisResult.advice.map((tip, idx) => (
            <View key={idx} style={styles.adviceCard}>
              <View style={styles.adviceNum}>
                <Text style={styles.adviceNumText}>{idx + 1}</Text>
              </View>
              <Text style={styles.adviceText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* ── SPF note ── */}
        <View style={styles.spfBox}>
          <MaterialCommunityIcons name="white-balance-sunny" size={18} color={TEAL} />
          <Text style={styles.spfText}>{analysisResult.spfNote}</Text>
        </View>

        {/* ── CTA ── */}
        <TouchableOpacity style={styles.tealBtn} onPress={handleViewProducts}>
          <Text style={styles.tealBtnText}>See product recommendations</Text>
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
    backgroundColor: '#F7F9FC',
    paddingHorizontal: 32,
    gap: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  pageBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Shared buttons ──
  tealBtn: {
    backgroundColor: TEAL,
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

  // ── No camera ──
  noCamera: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },

  // ── Guide text ──
  guideWrapper: {
    position: 'absolute',
    bottom: '16%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  guideText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: 32,
    paddingTop: 16,
  },
  galleryBtn: {
    alignItems: 'center',
    gap: 4,
    width: 72,
  },
  galleryBtnText: {
    color: 'white',
    fontSize: 11,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'white',
    borderWidth: 3,
    borderColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'white',
  },

  // ── Preview ──
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
    gap: 12,
  },
  privacyNote: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    textAlign: 'center',
  },
  previewBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
  },
  retakeBtnText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    fontSize: 15,
  },
  analyseBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: 'center',
  },
  analyseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // ── Loading ──
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: TEAL,
    opacity: 0.9,
  },
  loadingLabel: {
    position: 'absolute',
    bottom: '18%',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ── Results ──
  resultsPage: {
    flex: 1,
    backgroundColor: '#F7F9FC',
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
    color: '#111',
    textAlign: 'center',
    marginTop: 4,
  },

  // Skin type pill
  skinTypePill: {
    alignSelf: 'center',
    backgroundColor: TEAL,
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  skinTypePillText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.3,
  },

  // Sections
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },

  // Concern chips
  concernsRow: {
    gap: 8,
    flexDirection: 'row',
    paddingRight: 4,
  },
  concernChip: {
    backgroundColor: '#FEF3C7',
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  concernChipText: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '600',
  },

  // Advice cards
  adviceCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  adviceNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  adviceNumText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  adviceText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },

  // SPF note
  spfBox: {
    flexDirection: 'row',
    backgroundColor: '#E1F5EE',
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    borderRadius: 8,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  spfText: {
    flex: 1,
    fontSize: 13,
    color: '#065F46',
    lineHeight: 20,
  },

  // Scan again / disclaimer
  rescanBtn: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  rescanBtnText: {
    color: TEAL,
    fontWeight: '600',
    fontSize: 14,
  },
  disclaimer: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 4,
  },
});
