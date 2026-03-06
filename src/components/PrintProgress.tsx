/**
 * PrintProgress — Real-time printing progress overlay
 * Shows animated progress bar with status text during print jobs
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

interface Props {
  visible: boolean;
  progress: number;   // 0–100
  status: string;      // e.g. "Memproses gambar..."
  stage: 'prepare' | 'sending' | 'done' | 'error';
}

export default function PrintProgress({ visible, progress, status, stage }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  // Spinning animation for the icon
  useEffect(() => {
    if (visible && stage !== 'done' && stage !== 'error') {
      const loop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      spin.setValue(0);
    }
  }, [visible, stage]);

  // Pulse animation for done/error state
  useEffect(() => {
    if (stage === 'done' || stage === 'error') {
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [stage]);

  // Smooth progress bar animation
  useEffect(() => {
    Animated.timing(barWidth, {
      toValue: progress,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const spinInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getIcon = () => {
    switch (stage) {
      case 'prepare': return 'cog';
      case 'sending': return 'print';
      case 'done': return 'checkmark-circle';
      case 'error': return 'alert-circle';
    }
  };

  const getIconColor = () => {
    switch (stage) {
      case 'done': return '#22c55e';
      case 'error': return '#ef4444';
      default: return COLORS.primaryLight;
    }
  };

  const getBarColor = () => {
    switch (stage) {
      case 'done': return '#22c55e';
      case 'error': return '#ef4444';
      default: return COLORS.primary;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          {/* Icon */}
          <Animated.View style={[
            s.iconBox,
            (stage === 'done' || stage === 'error')
              ? { transform: [{ scale: pulse }] }
              : { transform: [{ rotate: spinInterpolate }] }
          ]}>
            <Ionicons name={getIcon() as any} size={48} color={getIconColor()} />
          </Animated.View>

          {/* Status Text */}
          <Text style={s.statusText}>{status}</Text>

          {/* Progress Bar */}
          <View style={s.barBg}>
            <Animated.View style={[
              s.barFill,
              {
                backgroundColor: getBarColor(),
                width: barWidth.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              }
            ]} />
          </View>

          {/* Percentage */}
          <Text style={s.percent}>{Math.round(progress)}%</Text>

          {/* Stage detail */}
          <Text style={s.detail}>
            {stage === 'prepare' && '⚙️ Mempersiapkan data cetak...'}
            {stage === 'sending' && '📡 Mengirim ke printer...'}
            {stage === 'done' && '✅ Selesai!'}
            {stage === 'error' && '❌ Gagal mencetak'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.bgCard,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.bgCardBorder,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(79,70,229,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  barBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  percent: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primaryLight,
  },
  detail: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
