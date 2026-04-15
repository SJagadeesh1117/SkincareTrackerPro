import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Toast from 'react-native-toast-message';

import { ActivateProductSheet } from '../../components/ActivateProductSheet';
import { COLORS } from '../../constants/theme';
import {
  markAsDelivered,
  markAsOrdered,
} from '../../services/productTrackingService';
import type { HomeActivationPayload, RootStackParamList, TrackedProduct } from '../../types';

type ProductStatus = 'recommended' | 'ordered' | 'delivered' | 'active';
type FilterKey = 'all' | ProductStatus;

interface ProductSection {
  key: ProductStatus;
  label: string;
  products: TrackedProduct[];
}

const SECTION_ORDER: ProductStatus[] = ['active', 'delivered', 'ordered', 'recommended'];

const SECTION_LABELS: Record<ProductStatus, string> = {
  active: 'Active in routine',
  delivered: 'Delivered - ready to use',
  ordered: 'Ordered - awaiting delivery',
  recommended: 'Recommended',
};

function normalizeStatus(value: unknown): ProductStatus {
  if (
    value === 'active' ||
    value === 'delivered' ||
    value === 'ordered' ||
    value === 'recommended'
  ) {
    return value;
  }

  return 'ordered';
}

function normalizeTrackedProduct(
  id: string,
  data: Record<string, unknown>,
): TrackedProduct {
  const keyIngredients = Array.isArray(data.keyIngredients)
    ? data.keyIngredients.filter(
        (ingredient): ingredient is string =>
          typeof ingredient === 'string' && ingredient.trim().length > 0,
      )
    : [];

  return {
    id,
    name:
      typeof data.name === 'string' && data.name.trim().length > 0
        ? data.name
        : 'Tracked product',
    brand: typeof data.brand === 'string' ? data.brand : '',
    category: typeof data.category === 'string' ? data.category : 'serum',
    whyItWorks: typeof data.whyItWorks === 'string' ? data.whyItWorks : '',
    keyIngredients,
    routineSlot:
      data.routineSlot === 'morning' ||
      data.routineSlot === 'night' ||
      data.routineSlot === 'both' ||
      data.routineSlot === 'weekly'
        ? data.routineSlot
        : 'morning',
    stepOrder: typeof data.stepOrder === 'number' ? data.stepOrder : 99,
    amazonProductUrl:
      typeof data.amazonProductUrl === 'string' ? data.amazonProductUrl : '',
    nykaaProductUrl:
      typeof data.nykaaProductUrl === 'string' ? data.nykaaProductUrl : '',
    estimatedAmazonPriceINR:
      typeof data.estimatedAmazonPriceINR === 'number'
        ? data.estimatedAmazonPriceINR
        : 0,
    estimatedNykaaPriceINR:
      typeof data.estimatedNykaaPriceINR === 'number'
        ? data.estimatedNykaaPriceINR
        : 0,
    status: normalizeStatus(data.status),
    isActive: data.status === 'active' || data.isActive === true,
    addedAt: (data.addedAt as TrackedProduct['addedAt']) ?? (null as any),
    orderedAt: (data.orderedAt as TrackedProduct['orderedAt']) ?? null,
    deliveredAt: (data.deliveredAt as TrackedProduct['deliveredAt']) ?? null,
    activatedAt: (data.activatedAt as TrackedProduct['activatedAt']) ?? null,
  };
}

function formatRoutineSlot(routineSlot: TrackedProduct['routineSlot']) {
  switch (routineSlot) {
    case 'night':
      return 'Night';
    case 'both':
      return 'Morning + Night';
    case 'weekly':
      return 'Weekly extras';
    default:
      return 'Morning';
  }
}

function getHomeActivationPayload(product: TrackedProduct): HomeActivationPayload {
  return {
    productId: product.id,
    productName: product.name,
    routineSlot: product.routineSlot,
  };
}

export function MyProductsScreen() {
  const navigation = useNavigation<any>();
  const [allProducts, setAllProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<TrackedProduct | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) {
      setAllProducts([]);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = firestore()
        .collection('trackedProducts')
        .doc(uid)
        .collection('items')
        .onSnapshot(
          snapshot => {
            const products = snapshot.docs.map(doc =>
              normalizeTrackedProduct(doc.id, doc.data() as Record<string, unknown>),
            );

            products.sort((a, b) => {
              const statusSort =
                SECTION_ORDER.indexOf(a.status) - SECTION_ORDER.indexOf(b.status);
              if (statusSort !== 0) {
                return statusSort;
              }

              return a.stepOrder - b.stepOrder || a.name.localeCompare(b.name);
            });

            setAllProducts(products);
            setLoading(false);
          },
          error => {
            console.error('Firestore listener error:', error);
            setAllProducts([]);
            setLoading(false);
            Toast.show({
              type: 'error',
              text1: 'Failed to load My Products',
            });
          },
        );
    } catch (error) {
      console.error('Firestore not available:', error);
      setAllProducts([]);
      setLoading(false);
      Toast.show({
        type: 'error',
        text1: 'Database unavailable',
        text2: 'Please rebuild the app from the C:\\stp path.',
      });
    }

    return () => unsubscribe?.();
  }, []);

  const countByStatus = useMemo(
    () =>
      allProducts.reduce(
        (acc, product) => {
          acc[product.status] = (acc[product.status] || 0) + 1;
          return acc;
        },
        {} as Record<ProductStatus, number>,
      ),
    [allProducts],
  );

  const displayedProducts = useMemo(
    () =>
      activeFilter === 'all'
        ? allProducts
        : allProducts.filter(product => product.status === activeFilter),
    [activeFilter, allProducts],
  );

  const sections = useMemo<ProductSection[]>(
    () =>
      SECTION_ORDER.map(status => ({
        key: status,
        label: SECTION_LABELS[status],
        products: displayedProducts.filter(product => product.status === status),
      })).filter(section => section.products.length > 0),
    [displayedProducts],
  );

  const handleMarkOrdered = async (productId: string) => {
    try {
      setActionLoadingId(productId);
      await markAsOrdered(productId);
      Toast.show({
        type: 'success',
        text1: 'Marked as ordered',
      });
    } catch (error) {
      console.error('Mark ordered failed', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to update product',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkDelivered = async (productId: string) => {
    try {
      setActionLoadingId(productId);
      await markAsDelivered(productId);
      Toast.show({
        type: 'success',
        text1: 'Marked as delivered',
        text2: 'Tap Start using to add it to your routine',
      });
    } catch (error) {
      console.error('Mark delivered failed', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to update product',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openActivationSheet = (product: TrackedProduct) => {
    setSelectedProduct(product);
    setSheetVisible(true);
  };

  const closeActivationSheet = () => {
    setSheetVisible(false);
    setSelectedProduct(null);
  };

  const handleActivated = () => {
    if (!selectedProduct) {
      return;
    }

    navigation.navigate('MainTabs', {
      screen: 'HomeTab',
      params: {
        activatedProduct: getHomeActivationPayload(selectedProduct),
      },
    } satisfies RootStackParamList['MainTabs']);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centeredScreen} edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.filterRow}>
        {(['all', 'active', 'delivered', 'ordered'] as FilterKey[]).map(filter => {
          const count =
            filter === 'all' ? allProducts.length : countByStatus[filter] || 0;
          const selected = filter === activeFilter;
          const label = filter.charAt(0).toUpperCase() + filter.slice(1);

          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, selected && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}>
              <Text
                style={[
                  styles.filterChipText,
                  selected && styles.filterChipTextActive,
                ]}>
                {count > 0 ? `${label} (${count})` : label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {allProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No products yet</Text>
            <Text style={styles.emptyBody}>
              Mark a recommendation as ordered and it will appear here automatically.
            </Text>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No products in this filter</Text>
          </View>
        ) : (
          sections.map(section => (
            <View key={section.key}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{section.products.length}</Text>
                </View>
              </View>

              {section.products.map(product => {
                const isLoadingAction = actionLoadingId === product.id;

                return (
                  <View key={product.id} style={styles.card}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productBrand}>{product.brand}</Text>
                    <Text style={styles.productMeta}>
                      {formatRoutineSlot(product.routineSlot)} · Step {product.stepOrder}
                    </Text>

                    {product.status === 'ordered' ? (
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        disabled={isLoadingAction}
                        onPress={() => handleMarkDelivered(product.id)}>
                        {isLoadingAction ? (
                          <ActivityIndicator size="small" color={COLORS.primary700} />
                        ) : (
                          <Text style={styles.secondaryButtonText}>
                            Mark as delivered
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : null}

                    {product.status === 'delivered' ? (
                      <TouchableOpacity
                        style={styles.primaryButton}
                        disabled={isLoadingAction}
                        onPress={() => openActivationSheet(product)}>
                        <Text style={styles.primaryButtonText}>
                          Start using
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {product.status === 'recommended' ? (
                      <TouchableOpacity
                        style={styles.primaryButton}
                        disabled={isLoadingAction}
                        onPress={() => handleMarkOrdered(product.id)}>
                        {isLoadingAction ? (
                          <ActivityIndicator size="small" color={COLORS.white} />
                        ) : (
                          <Text style={styles.primaryButtonText}>
                            Mark as ordered
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : null}

                    {product.status === 'active' ? (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>Active in your routine</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <ActivateProductSheet
        product={selectedProduct}
        visible={sheetVisible}
        onClose={closeActivationSheet}
        onActivated={handleActivated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.primary50,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary700,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  emptyState: {
    paddingHorizontal: 24,
    paddingTop: 120,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: COLORS.textMuted,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  countPill: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countPillText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  productBrand: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  productMeta: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  primaryButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  secondaryButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1030',
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary900,
  },
  activePill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#052E16',
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#86EFAC',
  },
});
