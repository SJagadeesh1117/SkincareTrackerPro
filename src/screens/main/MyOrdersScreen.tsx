/**
 * MyOrdersScreen.tsx
 *
 * Lists past orders from Firestore: orders/{uid}/orders ordered by placedAt desc.
 * Each row shows date, short order ID, total, and status badge.
 * Tapping a row expands it to show the product list within that order.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { format } from 'date-fns';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type { Order, OrderStatus } from '../../types';

// ── Constants ─────────────────────────────────────────────

const TEAL = '#1D9E75';

const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  paid:    { bg: '#D1FAE5', text: '#065F46' },
  pending: { bg: '#FEF3C7', text: '#92400E' },
  failed:  { bg: '#FEE2E2', text: '#991B1B' },
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  paid:    'Paid',
  pending: 'Pending',
  failed:  'Failed',
};

// ── Helpers ───────────────────────────────────────────────

function formatOrderDate(placedAt: any): string {
  try {
    const date: Date =
      placedAt?.toDate ? placedAt.toDate() :
      typeof placedAt === 'number' ? new Date(placedAt) :
      new Date(placedAt);
    return format(date, 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

function shortId(orderId: string): string {
  return orderId.length > 8 ? orderId.slice(-8) : orderId;
}

// ── Order row ─────────────────────────────────────────────

function OrderRow({
  order,
  expanded,
  onToggle,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusStyle = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;

  return (
    <View style={styles.orderCard}>
      {/* ── Summary row (always visible) ── */}
      <TouchableOpacity
        style={styles.orderSummaryRow}
        onPress={onToggle}
        activeOpacity={0.7}>

        <View style={styles.orderDateCol}>
          <Text style={styles.orderDate}>{formatOrderDate(order.placedAt)}</Text>
          <Text style={styles.orderShortId}>#{shortId(order.orderId)}</Text>
        </View>

        <View style={styles.orderMiddle}>
          <Text style={styles.orderAmount}>₹{order.totalAmountINR.toLocaleString('en-IN')}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {STATUS_LABELS[order.status] ?? order.status}
            </Text>
          </View>
        </View>

        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#9CA3AF"
        />
      </TouchableOpacity>

      {/* ── Expanded product list ── */}
      {expanded && (
        <View style={styles.productListWrap}>
          <View style={styles.productListDivider} />
          {order.products.map(product => (
            <View key={product.id} style={styles.productItem}>
              {product.imageUrl ? (
                <Image
                  source={{ uri: product.imageUrl }}
                  style={styles.productThumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.productThumb, styles.productThumbFallback]}>
                  <MaterialCommunityIcons name="flask-outline" size={18} color="#9CA3AF" />
                </View>
              )}
              <View style={styles.productItemInfo}>
                <Text style={styles.productItemName} numberOfLines={1}>{product.name}</Text>
                <Text style={styles.productItemBrand} numberOfLines={1}>{product.brand}</Text>
              </View>
              <Text style={styles.productItemPrice}>₹{product.priceINR.toLocaleString('en-IN')}</Text>
            </View>
          ))}

          <View style={styles.productListDivider} />
          <View style={styles.deliveryInfo}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color="#6B7280" />
            <Text style={styles.deliveryText} numberOfLines={2}>
              {order.deliveryAddress.fullName}, {order.deliveryAddress.addressLine1}
              {order.deliveryAddress.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''},
              {' '}{order.deliveryAddress.city}, {order.deliveryAddress.state} – {order.deliveryAddress.pinCode}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────

export function MyOrdersScreen({ navigation }: { navigation: any }) {
  const [orders,   setOrders]   = useState<Order[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadOrders = useCallback(async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    try {
      const snapshot = await firestore()
        .collection('orders')
        .doc(uid)
        .collection('orders')
        .orderBy('placedAt', 'desc')
        .get();

      const fetched: Order[] = snapshot.docs.map(doc => doc.data() as Order);
      setOrders(fetched);
    } catch {
      // Firestore unavailable (Windows build path issue) — show empty state
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const toggleExpand = useCallback((orderId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) { next.delete(orderId); } else { next.add(orderId); }
      return next;
    });
  }, []);

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.centred}>
        <ActivityIndicator size="large" color={TEAL} />
      </SafeAreaView>
    );
  }

  // ── Empty state ──────────────────────────────────────────
  if (orders.length === 0) {
    return (
      <SafeAreaView style={styles.centred}>
        <MaterialCommunityIcons name="package-variant-outline" size={72} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>No orders yet</Text>
        <Text style={styles.emptyBody}>
          No orders yet — scan your face to get started
        </Text>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => navigation.getParent()?.navigate('FaceScan')}
          activeOpacity={0.85}>
          <Text style={styles.ctaBtnText}>Scan my face</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Order list ───────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={item => item.orderId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <OrderRow
            order={item}
            expanded={expanded.has(item.orderId)}
            onToggle={() => toggleExpand(item.orderId)}
          />
        )}
        ListHeaderComponent={
          <Text style={styles.listHeader}>
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F7F9FC' },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F9FC',
    paddingHorizontal: 32,
    gap: 12,
  },

  // Empty state
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  emptyBody:  { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },
  ctaBtn: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // List
  listContent: { padding: 16, paddingBottom: 32 },
  listHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Order card
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  orderSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  orderDateCol:  { gap: 2 },
  orderDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
  },
  orderShortId: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  orderMiddle: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  statusBadge: {
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Expanded product list
  productListWrap:    { paddingHorizontal: 14, paddingBottom: 12 },
  productListDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  productThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  productThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  productItemInfo: { flex: 1 },
  productItemName: { fontSize: 13, fontWeight: '600', color: '#111' },
  productItemBrand:{ fontSize: 11, color: '#9CA3AF' },
  productItemPrice:{ fontSize: 13, fontWeight: '700', color: TEAL },

  // Delivery address
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  deliveryText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
});
