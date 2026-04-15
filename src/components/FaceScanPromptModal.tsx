/**
 * FaceScanPromptModal
 *
 * Shown every app open until the user has taken at least one face scan.
 * "Take scan now" navigates to ScanTab. "Remind me later" dismisses
 * for this session only — it will show again the next time the app opens.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface Props {
  visible: boolean;
  isFirstLogin: boolean;
  onTakeScan: () => void;
  onSkip: () => void;
}

export function FaceScanPromptModal({ visible, isFirstLogin, onTakeScan, onSkip }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 18,
          stiffness: 200,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onSkip}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <Animated.View
            style={[
              styles.card,
              { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
            ]}>
            {/* Icon */}
            <View style={styles.iconRing}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="face-recognition" size={36} color="#7F77DD" />
              </View>
            </View>

            {/* Heading */}
            <Text style={styles.heading}>
              {isFirstLogin ? 'Welcome! Let\'s get started 👋' : 'Take your face scan'}
            </Text>

            {/* Body */}
            <Text style={styles.body}>
              {isFirstLogin
                ? 'To give you personalised skincare recommendations, we need to analyse your skin. It only takes 30 seconds!'
                : 'You haven\'t taken a face scan yet. A quick scan helps us recommend the right products and track your skin\'s progress over time.'}
            </Text>

            {/* Benefits */}
            <View style={styles.benefits}>
              {[
                { icon: 'magnify-scan',      text: 'Identify your skin type & concerns' },
                { icon: 'bottle-tonic-plus', text: 'Get personalised product picks' },
                { icon: 'chart-line',        text: 'Track improvement week by week' },
              ].map(b => (
                <View key={b.icon} style={styles.benefitRow}>
                  <View style={styles.benefitIcon}>
                    <MaterialCommunityIcons name={b.icon} size={16} color="#7F77DD" />
                  </View>
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              ))}
            </View>

            {/* CTAs */}
            <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.85} onPress={onTakeScan}>
              <MaterialCommunityIcons name="camera" size={18} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>Take face scan now</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSkip} activeOpacity={0.7} onPress={onSkip}>
              <Text style={styles.btnSkipText}>Remind me later</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 10, 26, 0.75)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  safeArea: { justifyContent: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },

  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3C3489',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: '#534AB7',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },

  benefits: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitText: {
    fontSize: 13,
    color: '#3C3489',
    fontWeight: '500',
    flex: 1,
  },

  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#7F77DD',
    marginBottom: 10,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  btnSkip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  btnSkipText: {
    fontSize: 14,
    color: '#AFA9EC',
    fontWeight: '500',
  },
});
