import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import Toast from 'react-native-toast-message';

import { AppHeader } from '../../components/AppHeader';
import { COLORS } from '../../constants/theme';
import { saveRecommendedProductAsOrdered } from '../../services/productTrackingService';
import { useSkinAnalysisStore } from '../../store/skinAnalysisStore';
import { useSkinProfileStore } from '../../store/skinProfileStore';
import { fetchLatestProfile } from '../../services/skinProfileService';
import type {
  RecommendedProduct,
  RootStackParamList,
  SkinConcern,
} from '../../types';
import type { StackScreenProps } from '@react-navigation/stack';

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

const CATEGORY_LABELS: Record<string, string> = {
  cleanser: 'Cleanser',
  moisturiser: 'Moisturiser',
  sunscreen: 'Sunscreen',
  serum: 'Serum',
  toner: 'Toner',
  eye_cream: 'Eye Cream',
  exfoliant: 'Exfoliant',
};

function getRoutineSlotBadge(routineSlot: string) {
  if (routineSlot === 'night') {
    return {
      label: 'Night',
      backgroundColor: COLORS.primary800,
      textColor: COLORS.textOnPrimary,
    };
  }

  if (routineSlot === 'weekly') {
    return {
      label: 'Weekly',
      backgroundColor: '#F59E0B',
      textColor: '#92400E',
    };
  }

  if (routineSlot === 'both') {
    return {
      label: 'AM / PM',
      backgroundColor: COLORS.primary700,
      textColor: COLORS.textOnPrimary,
    };
  }

  return {
    label: 'Morning',
    backgroundColor: COLORS.primary,
    textColor: COLORS.textOnPrimary,
  };
}

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return encodeURI(withProtocol);
}

function buildSearchUrl(store: 'amazon' | 'nykaa', product: RecommendedProduct): string {
  const query = encodeURIComponent(`${product.name} ${product.brand}`.trim());
  return store === 'amazon'
    ? `https://www.amazon.in/s?k=${query}`
    : `https://www.nykaa.com/search/result/?q=${query}`;
}

type RecommendationsProps = StackScreenProps<RootStackParamList, 'RecommendationsScreen'>;

export function RecommendationsScreen({ navigation, route }: RecommendationsProps) {
  // Params are optional — screen can be opened from HomeScreen (store data)
  // or from FaceScanScreen (full params) or with no params at all.
  const paramProducts = route.params?.products;
  const paramSkinType = route.params?.skinType;
  const paramScanId   = route.params?.scanId;

  const latestResult    = useSkinAnalysisStore(s => s.latestResult);
  const storeProfile    = useSkinProfileStore(s => s.skinProfile);
  const storeRecs       = useSkinProfileStore(s => s.recommendations);
  const storeLoaded     = useSkinProfileStore(s => s.profileLoaded);
  const [openingUrl, setOpeningUrl] = useState<string | null>(null);

  // If no params and store not yet loaded, trigger a Firestore fetch.
  useEffect(() => {
    if (paramProducts?.length || storeLoaded) return;
    const uid = auth().currentUser?.uid;
    if (uid) fetchLatestProfile(uid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve products, skinType, scanId — params take priority, store is fallback.
  const products  = (paramProducts && paramProducts.length > 0) ? paramProducts  : (storeRecs      ?? []);
  const skinType  = paramSkinType ?? storeProfile?.skinType ?? '';
  const scanId    = paramScanId   ?? storeProfile?.scanId   ?? '';

  // Loading: no params and store hasn't finished fetching yet.
  const isLoading = !paramProducts?.length && !storeLoaded;

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, RecommendedProduct[]>();
    [...products]
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .forEach(product => {
        const current = groups.get(product.category) ?? [];
        groups.set(product.category, [...current, product]);
      });
    return Array.from(groups.entries());
  }, [products]);

  const concerns =
    latestResult?.scanId === scanId
      ? latestResult.concerns
      : storeProfile?.concerns ?? latestResult?.concerns ?? [];

  const handleOpenUrl = async (url: string, key: string) => {
    setOpeningUrl(key);
    try {
      await Linking.openURL(normalizeUrl(url));
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Link unavailable',
        text2: 'Unable to open this product link.',
      });
    } finally {
      setOpeningUrl(null);
    }
  };

  const handleMarkAsOrdered = async (product: RecommendedProduct) => {
    try {
      await saveRecommendedProductAsOrdered(product);
      Toast.show({
        type: 'success',
        text1: 'Added to My Products',
        text2: 'Open My Products to track delivery',
        visibilityTime: 1800,
      });
    } catch (error: unknown) {
      console.error('Failed to save tracked product', error, product);
      const message =
        error instanceof Error
          ? error.message
          : 'Could not save this product.';
      Toast.show({ type: 'error', text1: 'Save failed', text2: message });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.safeArea}>
        <AppHeader
          title="Your recommendations"
          rightActionTextColor={COLORS.textOnPrimary}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your analysis…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <AppHeader
        title="Your recommendations"
        rightActionLabel="Re-scan"
        rightActionTextColor={COLORS.textOnPrimary}
        onRightActionPress={() => navigation.navigate('MainTabs', { screen: 'ScanTab' } as any)}
      />

      <View style={styles.profileStrip}>
        <View style={styles.profileRow}>
          <View style={styles.skinBadge}>
            <Text style={styles.skinBadgeText}>{skinType} skin</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.concernsRow}>
            {concerns.map(concern => (
              <View key={concern} style={styles.concernChip}>
                <Text style={styles.concernChipText}>
                  {CONCERN_LABELS[concern] ?? concern}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {groupedProducts.map(([category, categoryProducts]) => (
          <View key={category}>
            <Text style={styles.categoryLabel}>
              {CATEGORY_LABELS[category] ?? category.replace('_', ' ')}
            </Text>

            {categoryProducts.map(product => {
              const badge = getRoutineSlotBadge(product.routineSlot);
              return (
                <View key={product.id} style={styles.productCard}>
                  <View style={styles.rowTop}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <View style={[styles.routineBadge, { backgroundColor: badge.backgroundColor }]}> 
                      <Text style={[styles.routineBadgeText, { color: badge.textColor }]}> 
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.brandText}>{product.brand}</Text>
                  <Text style={styles.whyText}>{product.whyItWorks}</Text>

                  <View style={styles.ingredientsRow}>
                    {product.keyIngredients.map(ingredient => (
                      <View key={ingredient} style={styles.ingredientChip}>
                        <Text style={styles.ingredientChipText}>{ingredient}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.priceRow}>
                    <TouchableOpacity
                      style={[styles.shopButton, styles.amazonButton]}
                      activeOpacity={0.85}
                      disabled={openingUrl !== null}
                      onPress={() => handleOpenUrl(
                        product.amazonProductUrl || buildSearchUrl('amazon', product),
                        `${product.id}_amazon`,
                      )}>
                      {openingUrl === `${product.id}_amazon` ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text style={styles.shopButtonText}>
                          Amazon {product.estimatedAmazonPriceINR}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.shopButton, styles.nykaaButton]}
                      activeOpacity={0.85}
                      disabled={openingUrl !== null}
                      onPress={() => handleOpenUrl(
                        product.nykaaProductUrl || buildSearchUrl('nykaa', product),
                        `${product.id}_nykaa`,
                      )}>
                      {openingUrl === `${product.id}_nykaa` ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text style={styles.shopButtonText}>
                          Nykaa {product.estimatedNykaaPriceINR}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.orderedButton}
                    activeOpacity={0.85}
                    onPress={() => handleMarkAsOrdered(product)}>
                    <Text style={styles.orderedButtonText}>Mark as ordered</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  profileStrip: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  profileRow: {
    gap: 10,
  },
  skinBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  skinBadgeText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  concernsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingRight: 8,
  },
  concernChip: {
    backgroundColor: COLORS.primary200,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  concernChipText: {
    color: COLORS.primary700,
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginTop: 12,
    marginBottom: 8,
  },
  productCard: {
    backgroundColor: '#211640',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 8,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  productName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  routineBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  routineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  brandText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  whyText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  ingredientsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  ingredientChip: {
    backgroundColor: COLORS.primary50,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ingredientChipText: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  shopButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amazonButton: {
    backgroundColor: COLORS.amazon,
  },
  nykaaButton: {
    backgroundColor: COLORS.nykaa,
  },
  shopButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  orderedButton: {
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderedButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary700,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
});
