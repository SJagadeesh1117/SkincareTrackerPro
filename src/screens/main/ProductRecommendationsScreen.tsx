/**
 * ProductRecommendationsScreen.tsx
 *
 * Personalised product recommendations screen.
 *
 * Flow:
 *   1. Read latest skin analysis from useSkinAnalysisStore.
 *   2. If no profile → show "Scan your face first" prompt.
 *   3. Else → call getRecommendations Cloud Function.
 *   4. Display 5 category sections, each with a horizontal ScrollView of cards.
 *   5. Sticky bottom bar tracks selection progress → navigate to BundleScreen.
 *
 * Card interaction:
 *   - First tap  → select card (deselects prev in same category) + expand details panel.
 *   - Same tap   → collapse details panel (card stays selected).
 *   - Other card → deselect old, select new, expand new panel.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useSkinAnalysisStore } from '../../store/skinAnalysisStore';
import type {
  CatalogProduct,
  ProductCategory,
  ProductTier,
  RecommendationsResult,
  RootStackParamList,
  SkinType,
  TierGroup,
} from '../../types';

// ── Config ────────────────────────────────────────────────────────────────────

// Gen 2 Cloud Run URL — same project number as analyseSkine.
const RECOMMENDATIONS_URL =
  'https://getrecommendations-213529858076.asia-south1.run.app';

const PURPLE = '#8B5CF6';
const BG = '#FAFAFA';
const { width: W } = Dimensions.get('window');
const CARD_WIDTH = W * 0.65;
const CARD_HEIGHT = 220;

// ── Tier styling ──────────────────────────────────────────────────────────────

const TIER_COLOR: Record<ProductTier, string> = {
  best: '#F59E0B',
  value: '#6B7280',
  budget: '#92400E',
};

const TIER_LABEL: Record<ProductTier, string> = {
  best: 'Best',
  value: 'Value',
  budget: 'Budget',
};

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  cleanser: 'Cleanser',
  moisturiser: 'Moisturiser',
  sunscreen: 'Sunscreen',
  serum: 'Serum',
  toner: 'Toner',
};

const CATEGORY_ICON: Record<ProductCategory, string> = {
  cleanser: 'water-outline',
  moisturiser: 'water-outline',
  sunscreen: 'weather-sunny',
  serum: 'test-tube',
  toner: 'flask-outline',
};

const SKIN_TYPE_LABEL: Record<SkinType, string> = {
  oily: 'Oily',
  dry: 'Dry',
  combination: 'Combination',
  sensitive: 'Sensitive',
  normal: 'Normal',
};

const CATEGORIES: ProductCategory[] = [
  'cleanser',
  'toner',
  'serum',
  'moisturiser',
  'sunscreen',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flatten a TierGroup into an ordered array: best → value → budget. */
function flattenTierGroup(group: TierGroup): CatalogProduct[] {
  return [...group.best, ...group.value, ...group.budget];
}

async function callGetRecommendations(): Promise<RecommendationsResult> {
  const user = auth().currentUser;
  if (!user) throw new Error('Not authenticated');

  const idToken = await user.getIdToken();
  const response = await fetch(RECOMMENDATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: {} }),
  });

  const json = await response.json();

  if (!response.ok) {
    const msg =
      json?.error?.message ?? json?.error?.status ?? `HTTP ${response.status}`;
    throw new Error(msg);
  }

  return json.result as RecommendationsResult;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProductRecommendationsScreen() {
  const stackNav = useNavigation<StackNavigationProp<RootStackParamList>>();

  function goToFaceScan() {
    stackNav.navigate('MainTabs', { screen: 'ScanTab' });
  }

  const latestResult = useSkinAnalysisStore(s => s.latestResult);
  const skinType = latestResult?.skinType ?? null;

  const [recommendations, setRecommendations] = useState<RecommendationsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // selected: one product per category
  const [selected, setSelected] = useState<Partial<Record<ProductCategory, CatalogProduct>>>({});

  // expanded: which card's detail panel is open
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<ProductCategory | null>(null);

  // ── Fetch recommendations ───────────────────────────────
  const fetchRecs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callGetRecommendations();
      setRecommendations(result);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load recommendations.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skinType) {
      fetchRecs();
    }
  }, [skinType, fetchRecs]);

  // ── Card tap handler ────────────────────────────────────
  function handleCardTap(product: CatalogProduct, category: ProductCategory) {
    // Toggle expand: same card tapped again collapses
    const isSameCard =
      expandedId === product.id && expandedCategory === category;

    setSelected(prev => ({ ...prev, [category]: product }));

    if (isSameCard) {
      setExpandedId(null);
      setExpandedCategory(null);
    } else {
      setExpandedId(product.id);
      setExpandedCategory(category);
    }
  }

  // ── Bundle nav ──────────────────────────────────────────
  const selectedCount = Object.keys(selected).length;
  const selectedProducts = Object.values(selected) as CatalogProduct[];

  function handleBuildBundle() {
    if (selectedCount === 0) return;
    stackNav.navigate('BundleScreen', { selectedProducts });
  }

  // ── Render ──────────────────────────────────────────────

  if (!skinType) {
    return <NoProfilePrompt onScan={goToFaceScan} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Skin profile chip */}
      <View style={styles.chipBar}>
        <TouchableOpacity
          style={styles.skinChip}
          onPress={goToFaceScan}
          activeOpacity={0.8}>
          <MaterialCommunityIcons name="face-recognition" size={14} color="#fff" />
          <Text style={styles.skinChipText}>
            For: {SKIN_TYPE_LABEL[skinType]} skin
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={14} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Main content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PURPLE} />
          <Text style={styles.loadingText}>Finding products for your skin…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRecs}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : recommendations ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {CATEGORIES.map(cat => (
            <CategorySection
              key={cat}
              category={cat}
              products={flattenTierGroup(recommendations[cat])}
              skinType={skinType}
              selectedId={selected[cat]?.id ?? null}
              expandedId={expandedCategory === cat ? expandedId : null}
              onCardTap={handleCardTap}
            />
          ))}
          {/* Spacer so last section isn't hidden under the sticky bar */}
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : null}

      {/* Sticky bundle bar */}
      {skinType && !loading && !error && (
        <BundleBar
          selectedCount={selectedCount}
          onBuild={handleBuildBundle}
        />
      )}
    </SafeAreaView>
  );
}

// ── NoProfilePrompt ───────────────────────────────────────────────────────────

function NoProfilePrompt({ onScan }: { onScan: () => void }) {
  return (
    <View style={styles.centered}>
      <View style={styles.promptCard}>
        <MaterialCommunityIcons name="face-scan" size={56} color={PURPLE} />
        <Text style={styles.promptTitle}>Scan your face first</Text>
        <Text style={styles.promptSub}>
          We need to know your skin type to recommend the right products for you.
        </Text>
        <TouchableOpacity style={styles.ctaBtn} onPress={onScan} activeOpacity={0.85}>
          <MaterialCommunityIcons name="camera" size={18} color="#fff" />
          <Text style={styles.ctaBtnText}>Start Face Scan</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── CategorySection ───────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: ProductCategory;
  products: CatalogProduct[];
  skinType: SkinType;
  selectedId: string | null;
  expandedId: string | null;
  onCardTap: (product: CatalogProduct, category: ProductCategory) => void;
}

function CategorySection({
  category,
  products,
  skinType,
  selectedId,
  expandedId,
  onCardTap,
}: CategorySectionProps) {
  const expandedProduct = products.find(p => p.id === expandedId) ?? null;

  if (products.length === 0) return null;

  return (
    <View style={styles.categorySection}>
      {/* Section header */}
      <View style={styles.categoryHeader}>
        <MaterialCommunityIcons
          name={CATEGORY_ICON[category]}
          size={18}
          color={PURPLE}
        />
        <Text style={styles.categoryTitle}>{CATEGORY_LABEL[category]}</Text>
        <Text style={styles.categoryCount}>{products.length} options</Text>
      </View>

      {/* Horizontal card row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}>
        {products.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            skinType={skinType}
            isSelected={product.id === selectedId}
            isExpanded={product.id === expandedId}
            onTap={() => onCardTap(product, category)}
          />
        ))}
      </ScrollView>

      {/* Expandable details panel */}
      {expandedProduct && (
        <DetailsPanel product={expandedProduct} skinType={skinType} />
      )}
    </View>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: CatalogProduct;
  skinType: SkinType;
  isSelected: boolean;
  isExpanded: boolean;
  onTap: () => void;
}

function ProductCard({
  product,
  skinType,
  isSelected,
  isExpanded,
  onTap,
}: ProductCardProps) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        isExpanded && styles.cardExpanded,
      ]}
      onPress={onTap}
      activeOpacity={0.85}>

      {/* Checkmark top-left (selected) */}
      {isSelected && (
        <View style={styles.checkCircle}>
          <MaterialCommunityIcons name="check" size={12} color="#fff" />
        </View>
      )}

      {/* Tier badge top-right */}
      <View style={[styles.tierBadge, { backgroundColor: TIER_COLOR[product.tier] }]}>
        <Text style={styles.tierBadgeText}>{TIER_LABEL[product.tier]}</Text>
      </View>

      {/* Product image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: product.imageUrl }}
          style={styles.productImage}
          resizeMode="cover"
        />
      </View>

      {/* Product details */}
      <View style={styles.cardContent}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.productBrand} numberOfLines={1}>
          {product.brand}
        </Text>
        <Text style={styles.productPrice}>
          ₹{product.priceINR.toLocaleString('en-IN')}
        </Text>
        <Text style={styles.perfectFor} numberOfLines={1}>
          Perfect for {SKIN_TYPE_LABEL[skinType].toLowerCase()} skin
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── DetailsPanel ──────────────────────────────────────────────────────────────

function DetailsPanel({ product, skinType }: { product: CatalogProduct; skinType: SkinType }) {
  return (
    <View style={styles.detailsPanel}>
      {/* Key ingredients */}
      <Text style={styles.detailsLabel}>Key Ingredients</Text>
      <View style={styles.ingredientsRow}>
        {product.keyIngredients.map(ing => (
          <View key={ing} style={styles.ingredientChip}>
            <Text style={styles.ingredientText}>{ing}</Text>
          </View>
        ))}
      </View>

      {/* Why it works */}
      <Text style={styles.detailsLabel}>Why it works for {SKIN_TYPE_LABEL[skinType].toLowerCase()} skin</Text>
      <Text style={styles.whyItWorks}>{product.whyItWorks}</Text>

      {/* Usage instructions */}
      <Text style={styles.detailsLabel}>How to use</Text>
      <View style={styles.instructionRow}>
        <MaterialCommunityIcons name="information-outline" size={14} color={PURPLE} />
        <Text style={styles.instructionsText}>{product.instructions}</Text>
      </View>
    </View>
  );
}

// ── BundleBar ─────────────────────────────────────────────────────────────────

function BundleBar({
  selectedCount,
  onBuild,
}: {
  selectedCount: number;
  onBuild: () => void;
}) {
  const enabled = selectedCount > 0;

  return (
    <View style={styles.bundleBar}>
      <View style={styles.bundleProgress}>
        <Text style={styles.bundleProgressText}>
          {selectedCount} of 5 categories selected
        </Text>
        {/* Progress dots */}
        <View style={styles.progressDots}>
          {[0, 1, 2, 3, 4].map(i => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < selectedCount && styles.progressDotFilled,
              ]}
            />
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.buildBtn, !enabled && styles.buildBtnDisabled]}
        onPress={onBuild}
        disabled={!enabled}
        activeOpacity={0.85}>
        <Text style={[styles.buildBtnText, !enabled && styles.buildBtnTextDisabled]}>
          Build my bundle
        </Text>
        <MaterialCommunityIcons
          name="arrow-right"
          size={18}
          color={enabled ? '#fff' : '#9CA3AF'}
        />
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  // Chip bar
  chipBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  skinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PURPLE,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  skinChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  // Loading / error
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: PURPLE,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // No profile prompt
  promptCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    maxWidth: 320,
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginTop: 4,
  },
  promptSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PURPLE,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },
  // Category section
  categorySection: {
    marginBottom: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    flex: 1,
  },
  categoryCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  cardRow: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 4,
  },
  // Product card
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSelected: {
    borderColor: PURPLE,
  },
  cardExpanded: {
    borderColor: PURPLE,
  },
  checkCircle: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tierBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 2,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  imageContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  cardContent: {
    gap: 2,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    lineHeight: 18,
  },
  productBrand: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: PURPLE,
    marginTop: 2,
  },
  perfectFor: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 2,
  },
  // Details panel
  detailsPanel: {
    backgroundColor: '#F8F5FF',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C4B5FD',
    gap: 8,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6D28D9',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  ingredientsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ingredientChip: {
    backgroundColor: '#EDE9FE',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ingredientText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
  },
  whyItWorks: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  instructionsText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  // Bundle bar
  bundleBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  bundleProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bundleProgressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  progressDots: {
    flexDirection: 'row',
    gap: 5,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  progressDotFilled: {
    backgroundColor: PURPLE,
  },
  buildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PURPLE,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buildBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  buildBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  buildBtnTextDisabled: {
    color: '#9CA3AF',
  },
});
