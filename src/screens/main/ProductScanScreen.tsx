/**
 * ProductScanScreen.tsx
 *
 * Camera + gallery capture for skincare product identification.
 *
 * States:
 *   permission → request camera access
 *   capture    → live back-camera preview with product-box overlay
 *   preview    → review captured / picked image
 *   loading    → spinner while GPT-4o Vision identifies the product
 *   error      → display error with retry / retake options
 *
 * On success → navigate to ProductConfirmScreen with extracted identifiers.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import type { PhotoFile } from 'react-native-vision-camera';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import Svg, { Path } from 'react-native-svg';
import RNFS from 'react-native-fs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { identifyProductFromImage } from '../../services/openaiService';
import type { RoutineSlotParam } from '../../types';

// ── Layout constants ──────────────────────────────────────────────────────────

const { width: W, height: H } = Dimensions.get('window');

// Product-label guide box (centred, landscape-ish ratio)
const BOX_W = W * 0.82;
const BOX_H = H * 0.34;
const BOX_X = (W - BOX_W) / 2;
const BOX_Y = H * 0.27;
const BOX_R = 18; // corner radius

// Max file size we'll send — larger files are read raw (RNFS handles it)
const MAX_RAW_BYTES = 3 * 1024 * 1024;

// ── SVG overlay helpers ───────────────────────────────────────────────────────

function roundedRectPath(
  x: number, y: number,
  w: number, h: number,
  r: number,
): string {
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

// Full-screen dimmed overlay with a transparent rounded-rect cut-out
const OVERLAY_PATH =
  `M 0 0 H ${W} V ${H} H 0 Z ` +
  roundedRectPath(BOX_X, BOX_Y, BOX_W, BOX_H, BOX_R);

function ProductOverlay() {
  return (
    <Svg
      width={W}
      height={H}
      style={StyleSheet.absoluteFill}
      pointerEvents="none">
      {/* Dimmed surround */}
      <Path
        fillRule="evenodd"
        d={OVERLAY_PATH}
        fill="rgba(0,0,0,0.58)"
      />
      {/* Purple guide border */}
      <Path
        d={roundedRectPath(BOX_X, BOX_Y, BOX_W, BOX_H, BOX_R)}
        stroke="#C4B5FD"
        strokeWidth={2.5}
        fill="none"
      />
    </Svg>
  );
}

// ── Image helper ──────────────────────────────────────────────────────────────

async function uriToBase64(uri: string): Promise<string> {
  // content:// URIs (Android gallery picks) are read directly by RNFS
  if (uri.startsWith('content://')) {
    return RNFS.readFile(uri, 'base64');
  }

  const fsPath = uri.startsWith('file://') ? uri.slice(7) : uri;

  try {
    const stat = await RNFS.stat(fsPath);
    const size = typeof stat.size === 'number' ? stat.size : parseInt(String(stat.size), 10);
    // If the file is within the size budget, read it directly
    if (size <= MAX_RAW_BYTES) {
      return RNFS.readFile(fsPath, 'base64');
    }
  } catch {
    // stat failed — fall through to direct read
  }

  // Large file: read raw and let the API handle it
  // (GPT-4o's 'low' detail mode re-samples to 512×512 px anyway)
  return RNFS.readFile(fsPath, 'base64');
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // Root
    blackFill:  { flex: 1, backgroundColor: '#000' },
    lightFill:  { flex: 1, backgroundColor: colors.background },
    absoluteFill: StyleSheet.absoluteFillObject,

    // Floating header (sits over camera / image)
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'android' ? 12 : 4,
      paddingBottom: 10,
      gap: 10,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(0,0,0,0.42)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: '#FFF',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    slotBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderRadius: 8,
    },
    slotBadgeText: { fontSize: 12, fontWeight: '600', color: '#FFF' },

    // Guide text below the box
    guideText: {
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
      fontSize: 13,
      color: 'rgba(255,255,255,0.82)',
      fontWeight: '500',
    },

    // Camera bottom controls
    cameraBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 44,
      paddingTop: 20,
      paddingBottom: 42,
      backgroundColor: 'rgba(0,0,0,0.52)',
    },
    galleryBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterOuter: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 4,
      borderColor: '#FFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#FFF',
    },

    // Preview image + controls
    previewImage: { flex: 1 },
    previewBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 42,
      backgroundColor: 'rgba(0,0,0,0.62)',
    },
    retakeBtn: {
      flex: 1,
      height: 52,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: '#FFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    retakeBtnText:  { fontSize: 15, fontWeight: '600', color: '#FFF' },
    useBtn: {
      flex: 1,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    useBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

    // Loading overlay
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.72)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
    },
    loadingText: { fontSize: 15, fontWeight: '500', color: '#FFF' },

    // Permission / error full-screen layout
    centeredContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      backgroundColor: colors.background,
    },
    centeredTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primaryDark,
      textAlign: 'center',
      marginTop: 20,
      marginBottom: 8,
    },
    centeredSubtitle: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 28,
    },
    primaryBtn: {
      width: '100%',
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
    secondaryBtn: {
      width: '100%',
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    secondaryBtnText: { fontSize: 15, fontWeight: '500', color: colors.primaryMid },

    // Error card
    errorCard: {
      width: '100%',
      backgroundColor: colors.white,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: '#FEE2E2',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    errorTitle: { fontSize: 16, fontWeight: '700', color: '#DC2626', textAlign: 'center' },
    errorMsg: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 19,
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type ScreenState = 'permission' | 'capture' | 'preview' | 'loading' | 'error';

function slotLabel(slot: RoutineSlotParam): string {
  switch (slot) {
    case 'morning': return 'Morning';
    case 'evening': return 'Evening';
    case 'weekly':  return 'Weekly';
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ProductScanScreen() {
  const { colors } = useTheme();
  const styles     = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const isFocused  = useIsFocused();

  const slot: RoutineSlotParam = route.params?.slot ?? 'morning';

  // Vision Camera
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);

  // Shutter press animation
  const shutterScale = useRef(new Animated.Value(1)).current;

  // Screen state machine
  const [screenState, setScreenState] = useState<ScreenState>(
    hasPermission ? 'capture' : 'permission',
  );
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState('');

  // If permission arrives (e.g. user grants it and comes back)
  useEffect(() => {
    if (hasPermission && screenState === 'permission') {
      setScreenState('capture');
    }
  }, [hasPermission, screenState]);

  // ── Camera controls ───────────────────────────────────────────────────────

  const onShutterPressIn = useCallback(() => {
    Animated.spring(shutterScale, {
      toValue: 0.89,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  }, [shutterScale]);

  const onShutterPressOut = useCallback(() => {
    Animated.spring(shutterScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 5,
    }).start();
  }, [shutterScale]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });
      // VisionCamera v4 returns path without file:// prefix
      const uri = photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`;
      setCapturedUri(uri);
      setScreenState('preview');
    } catch (e) {
      console.warn('[ProductScan] takePhoto error:', e);
    }
  }, []);

  const handleGallery = useCallback(() => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, res => {
      if (res.didCancel || res.errorCode) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      setCapturedUri(asset.uri);
      setScreenState('preview');
    });
  }, []);

  // ── Preview controls ──────────────────────────────────────────────────────

  const handleRetake = useCallback(() => {
    setCapturedUri(null);
    setErrorMsg('');
    setScreenState('capture');
  }, []);

  const handleUsePhoto = useCallback(async () => {
    if (!capturedUri) return;
    setScreenState('loading');

    try {
      const imageBase64 = await uriToBase64(capturedUri);
      const result      = await identifyProductFromImage(imageBase64);

      // Navigate to confirm screen — pass file URI for thumbnail display
      navigation.navigate('ProductConfirmScreen', {
        brand:        result.brand,
        product_name: result.product_name,
        barcode:      result.barcode,
        imageUri:     capturedUri,
        slot,
      });

      // Reset so camera is fresh if user navigates back
      setCapturedUri(null);
      setScreenState('capture');
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? 'Something went wrong.';
      setErrorMsg(msg);
      setScreenState('error');
    }
  }, [capturedUri, navigation, slot]);

  const handleRetry = useCallback(() => {
    setErrorMsg('');
    setScreenState('preview'); // let them try "Use this photo" again
  }, []);

  // ── Permission screen ─────────────────────────────────────────────────────

  if (screenState === 'permission') {
    return (
      <SafeAreaView style={styles.lightFill} edges={['top', 'bottom']}>
        <View style={styles.centeredContainer}>
          <MaterialCommunityIcons
            name="camera-lock-outline"
            size={68}
            color={colors.primary}
          />
          <Text style={styles.centeredTitle}>Camera Access Needed</Text>
          <Text style={styles.centeredSubtitle}>
            Allow camera access to scan product labels and automatically identify your skincare.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.8}
            onPress={async () => {
              const granted = await requestPermission();
              if (granted) {
                setScreenState('capture');
              } else {
                Alert.alert(
                  'Camera access denied',
                  'Enable camera access in your device Settings to use this feature.',
                  [{ text: 'OK' }],
                );
              }
            }}>
            <Text style={styles.primaryBtnText}>Allow Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error screen ──────────────────────────────────────────────────────────

  if (screenState === 'error') {
    return (
      <SafeAreaView style={styles.lightFill} edges={['top', 'bottom']}>
        <View style={styles.centeredContainer}>
          <View style={styles.errorCard}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={52}
              color="#DC2626"
            />
            <Text style={styles.errorTitle}>Identification Failed</Text>
            <Text style={styles.errorMsg}>{errorMsg}</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 4 }]}
              activeOpacity={0.8}
              onPress={handleRetry}>
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.8}
              onPress={handleRetake}>
              <Text style={styles.secondaryBtnText}>Retake Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main camera / preview / loading layout ────────────────────────────────

  return (
    <View style={styles.blackFill}>

      {/* Live camera — only rendered in capture state */}
      {screenState === 'capture' && device && (
        <Camera
          ref={cameraRef}
          style={styles.absoluteFill}
          device={device}
          isActive={isFocused}
          photo
        />
      )}

      {/* Static image — preview and loading states */}
      {(screenState === 'preview' || screenState === 'loading') && capturedUri && (
        <Image
          source={{ uri: capturedUri }}
          style={styles.previewImage}
          resizeMode="cover"
        />
      )}

      {/* Dimmed overlay with guide box cut-out (capture only) */}
      {screenState === 'capture' && <ProductOverlay />}

      {/* ── Floating header ── */}
      <SafeAreaView edges={['top']} style={styles.absoluteFill} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Product</Text>
          <View style={styles.slotBadge}>
            <Text style={styles.slotBadgeText}>{slotLabel(slot)}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Guide label below the box */}
      {screenState === 'capture' && (
        <Text
          style={[styles.guideText, { top: BOX_Y + BOX_H + 18 }]}
          pointerEvents="none">
          Align the product label inside the box
        </Text>
      )}

      {/* ── Camera controls bar ── */}
      {screenState === 'capture' && (
        <View style={styles.cameraBar}>
          {/* Gallery picker */}
          <TouchableOpacity
            style={styles.galleryBtn}
            activeOpacity={0.8}
            onPress={handleGallery}>
            <MaterialCommunityIcons name="image-outline" size={26} color="#FFF" />
          </TouchableOpacity>

          {/* Shutter button */}
          <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
            <TouchableOpacity
              style={styles.shutterOuter}
              activeOpacity={1}
              onPressIn={onShutterPressIn}
              onPressOut={onShutterPressOut}
              onPress={handleCapture}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          </Animated.View>

          {/* Symmetry spacer */}
          <View style={{ width: 52 }} />
        </View>
      )}

      {/* ── Preview controls bar ── */}
      {screenState === 'preview' && (
        <View style={styles.previewBar}>
          <TouchableOpacity
            style={styles.retakeBtn}
            activeOpacity={0.8}
            onPress={handleRetake}>
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.useBtn}
            activeOpacity={0.8}
            onPress={handleUsePhoto}>
            <Text style={styles.useBtnText}>Use this photo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Loading overlay ── */}
      {screenState === 'loading' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Identifying product...</Text>
        </View>
      )}

    </View>
  );
}
