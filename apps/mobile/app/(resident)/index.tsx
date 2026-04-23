import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Image, ImageBackground, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  AppButton,
  AppScreen,
  BodyText,
  EmptyState,
  ErrorState,
  Heading,
  LoadingState,
  SectionCard,
  Title,
} from "../../src/components/ui";
import { useSession } from "../../src/features/auth/session";
import { PromoBanner } from "../../src/features/resident/PromoBanner";
import { ResidentRequestCard } from "../../src/features/resident/ResidentRequestCard";
import {
  getCategoryEmoji,
  getCategoryKey,
  getCategoryLabel,
} from "../../src/features/resident/requestPresentation";
import { useResidentDashboard } from "../../src/features/resident/useResidentDashboard";
import { formatCurrency, summarizeText } from "../../src/lib/format";
import { tokens } from "../../src/theme/tokens";
import { font } from "../../src/theme/typography";

const residentHeroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAJ6CgfYE3uGJ6IsmghNbjp3h3DAu2xAYO8dKY09jaK1CKaKRa-pRKGLaaQr8U7uKoYyB9EGQki9knCG_KOrby0-ATQhRT3W8y5ljv0IuF8N2XhY9QIdcTj8_KGsoej4y9Ds2guJhHrB0cH4GdBPvnz-dGr57bwN1QqXJfhkor0LOgSNcEWBcLDEXKxzAOhaWLL-69LjPhZ4Ye-DrHoNAcp7SgCkz7jJ2hTDiu2IVOg5wq-akqUUyE_y-k-kvr9JtPm_bmxUToHqVu8";
const HERO_HEIGHT = 450;
const HERO_SEARCH_TOP = 18;
const HERO_SEARCH_HEIGHT = 52;
const DRAWER_START_OFFSET = 432;
const FLOATING_SEARCH_THRESHOLD = DRAWER_START_OFFSET - (HERO_SEARCH_TOP + HERO_SEARCH_HEIGHT + 8);
const featuredRepairsImage = require("../../assets/images/featured-repairs.png");
const featuredMarketplaceImage = require("../../assets/images/featured-marketplace.png");
const featuredMaintenanceImage = require("../../assets/images/featured-maintenance.png");
const repairsBannerPersonImage = require("../../assets/images/role-provider.png");
const promoCalendarImage = require("../../assets/images/promo-calendar.png");

type FeaturedServiceDefinition = {
  id: "repairs" | "marketplace" | "maintenance";
  title: string;
  image: ImageSourcePropType;
  matches: (label: string, key: string) => boolean;
};

const FEATURED_SERVICE_DEFINITIONS: FeaturedServiceDefinition[] = [
  {
    id: "repairs",
    title: "Repairs",
    image: featuredRepairsImage,
    matches: (label, key) =>
      /repair|artisan|plumb|electric|electr|carpent|home care|handyman/.test(label) ||
      /repair|artisan|plumb|electric|electr|carpent|home-care|handyman/.test(key),
  },
  {
    id: "marketplace",
    title: "Marketplace",
    image: featuredMarketplaceImage,
    matches: (label, key) =>
      /market|mart|shop|store|delivery|logistics/.test(label) ||
      /market|mart|shop|store|delivery|logistics/.test(key),
  },
  {
    id: "maintenance",
    title: "Maintenance",
    image: featuredMaintenanceImage,
    matches: (label, key) =>
      /maintenance|clean|facility|service plan/.test(label) ||
      /maintenance|clean|facility|service-plan/.test(key),
  },
];

export default function ResidentHomeScreen() {
  const { user } = useSession();
  const { categoriesQuery, requestsQuery, statsQuery, marketTrendsQuery } = useResidentDashboard();
  const [showFloatingSearch, setShowFloatingSearch] = useState(false);

  if (categoriesQuery.isLoading || requestsQuery.isLoading || statsQuery.isLoading || marketTrendsQuery.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="Loading resident dashboard..." />
      </AppScreen>
    );
  }

  if (categoriesQuery.isError || requestsQuery.isError || statsQuery.isError || marketTrendsQuery.isError) {
    return (
      <AppScreen>
        <ErrorState
          body="The resident dashboard could not be loaded from the current backend endpoints."
          action={
            <AppButton
              variant="secondary"
              onPress={() => {
                void categoriesQuery.refetch();
                void requestsQuery.refetch();
                void statsQuery.refetch();
                void marketTrendsQuery.refetch();
              }}
            >
              Retry
            </AppButton>
          }
        />
      </AppScreen>
    );
  }

  const stats = statsQuery.data;
  const categories = categoriesQuery.data || [];
  const recentRequests = (requestsQuery.data || []).slice(0, 4);
  const activeTrendSeries = (marketTrendsQuery.data?.series || []).filter((series) => series.isActive !== false);
  const featuredServices = FEATURED_SERVICE_DEFINITIONS.map((definition) => {
    const matchedCategory =
      categories.find((category) => {
        const label = getCategoryLabel(category).toLowerCase();
        const key = getCategoryKey(category).toLowerCase();
        return definition.matches(label, key);
      }) || null;

    return {
      ...definition,
      category: matchedCategory,
    };
  });

  function openFeaturedService(service: (typeof featuredServices)[number]) {
    if (service.id === "maintenance") {
      router.push("/(resident)/maintenance");
      return;
    }

    if (service.category) {
      router.push({
        pathname: "/(resident)/request-flow",
        params: { categoryKey: getCategoryKey(service.category) },
      });
      return;
    }

    if (service.id === "marketplace") {
      router.push("/(resident)/requests");
      return;
    }

    router.push("/(resident)/request-flow");
  }

  function handleScroll(offsetY: number) {
    const shouldShow = offsetY >= FLOATING_SEARCH_THRESHOLD;
    setShowFloatingSearch((current) => (current === shouldShow ? current : shouldShow));
  }

  return (
    <AppScreen scroll={false} padded={false} style={styles.screen}>
      {showFloatingSearch ? (
        <Pressable style={styles.floatingSearchBar} onPress={() => router.push("/(resident)/request-flow")}>
          <Ionicons name="search-outline" size={18} color="#FFFFFF" />
          <Text style={styles.searchText}>Search</Text>
        </Pressable>
      ) : null}

      <View style={styles.heroSticky}>
        <ImageBackground source={{ uri: residentHeroImage }} style={styles.heroImageShell} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <Pressable style={styles.searchBar} onPress={() => router.push("/(resident)/request-flow")}>
            <Ionicons name="search-outline" size={18} color="#FFFFFF" />
            <Text style={styles.searchText}>Search</Text>
          </Pressable>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>Logistics</Text>
            <Text style={styles.heroTitle}>Book VGC-certified artisan</Text>
            <Text style={styles.heroBody}>
              Book certified technicians for your home repairs and care with the same backend-powered request flow.
            </Text>
            <View style={styles.heroDots}>
              <View style={[styles.heroDot, styles.heroDotActive]} />
              <View style={styles.heroDot} />
              <View style={styles.heroDot} />
            </View>
          </View>
        </ImageBackground>
      </View>

      <ScrollView
        style={styles.homeScroll}
        contentContainerStyle={styles.homeScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => handleScroll(event.nativeEvent.contentOffset.y)}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.servicesSection}>
            {featuredServices.map((service) => {
              return (
                <Pressable
                  key={service.id}
                  onPress={() => openFeaturedService(service)}
                  style={styles.serviceCard}
                >
                  <View style={styles.serviceImageWrap}>
                    <Image source={service.image} style={styles.serviceImage} resizeMode="contain" />
                  </View>
                  <Text style={styles.serviceTitle}>{service.title}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.contentWrap}>
            <View style={styles.sectionHeader}>
              <Title>Save time</Title>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bannerCarouselContent}
              decelerationRate="fast"
              snapToAlignment="start"
              snapToInterval={324}
            >
              <View style={styles.bannerSlide}>
                <PromoBanner
                  image={repairsBannerPersonImage}
                  title={"Book appointment\nfor home repairs"}
                  buttonLabel="Book now"
                  backgroundColor="#039855"
                  textColor="#FFFFFF"
                  buttonBackgroundColor="#FFFFFF"
                  buttonTextColor="#2B2B2B"
                  imageBackgroundColor="#FFFFFF"
                  onPress={() => router.push("/(resident)/request-flow")}
                />
              </View>
              <View style={styles.bannerSlide}>
                <PromoBanner
                  image={promoCalendarImage}
                  title={"Schedule your\nnext trip"}
                  buttonLabel="Book now"
                  backgroundColor="#2F2F31"
                  textColor="#FFFFFF"
                  buttonBackgroundColor="#FFFFFF"
                  buttonTextColor="#2B2B2B"
                  imageBackgroundColor="#FFFFFF"
                  onPress={() => router.push("/(resident)/maintenance")}
                />
              </View>
            </ScrollView>

            <SectionCard>
              <Title>Market pulse</Title>
              <BodyText muted>
                This card is driven by the same admin-managed market trend series exposed to the resident web homepage.
              </BodyText>
              {!activeTrendSeries.length ? (
                <BodyText muted>No active market trend series are currently published.</BodyText>
              ) : (
                <View style={styles.marketSeriesList}>
                  {activeTrendSeries.map((series) => {
                    const latestPoint = [...series.points].sort((left, right) => right.monthIndex - left.monthIndex)[0];
                    return (
                      <View key={series.id} style={styles.marketRow}>
                        <View style={[styles.marketSwatch, { backgroundColor: series.color || tokens.color.primary }]} />
                        <View style={styles.marketCopy}>
                          <Text style={styles.marketTitle}>{series.name}</Text>
                          <Text style={styles.marketMeta}>
                            {latestPoint
                              ? `${latestPoint.monthLabel}: ${latestPoint.value}${series.unit ? ` ${series.unit}` : ""}`
                              : "No data points yet"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </SectionCard>

            <SectionCard>
              <Title>Recent requests</Title>
              {recentRequests.map((request) => (
                <ResidentRequestCard
                  key={request.id}
                  request={request}
                  compact
                  onPress={() =>
                    router.push({
                      pathname: "/(resident)/request-detail",
                      params: { requestId: request.id },
                    })
                  }
                />
              ))}
              {!recentRequests.length ? (
                <EmptyState
                  title="No requests yet"
                  body="Your active and historical service requests will appear here."
                  action={<AppButton onPress={() => router.push("/(resident)/request-flow")}>Start one</AppButton>}
                />
              ) : null}
            </SectionCard>
          </View>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  floatingSearchBar: {
    alignItems: "center",
    backgroundColor: "rgba(24, 24, 24, 0.92)",
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    left: tokens.spacing.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    position: "absolute",
    right: tokens.spacing.lg,
    top: HERO_SEARCH_TOP,
    zIndex: 4,
  },
  heroSticky: {
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 0,
  },
  homeScroll: {
    flex: 1,
    zIndex: 1,
  },
  homeScrollContent: {
    paddingTop: DRAWER_START_OFFSET,
    paddingBottom: tokens.spacing.xl,
  },
  heroImageShell: {
    height: HERO_HEIGHT,
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: HERO_SEARCH_TOP,
    paddingBottom: 34,
  },
  heroImage: {
    resizeMode: "cover",
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(14, 22, 18, 0.34)",
  },
  searchBar: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "rgba(24, 24, 24, 0.72)",
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  searchText: {
    ...font("500"),
    color: "#FFFFFF",
    fontSize: 16,
  },
  heroCopy: {
    gap: 10,
  },
  heroEyebrow: {
    ...font("600"),
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
  },
  heroTitle: {
    ...font("800"),
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 28,
  },
  heroBody: {
    ...font("400"),
    color: "rgba(255,255,255,0.86)",
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 320,
  },
  heroDots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  heroDot: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  heroDotActive: {
    backgroundColor: "#F5D90A",
  },
  sheet: {
    backgroundColor: "#F2F2F2",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#D8DCDD",
    borderRadius: 999,
    height: 5,
    marginBottom: 14,
    width: 42,
  },
  servicesSection: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: tokens.spacing.lg,
  },
  serviceCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    flex: 1,
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  serviceImageWrap: {
    alignItems: "center",
    borderRadius: 16,
    height: 76,
    justifyContent: "center",
    width: "100%",
  },
  serviceImage: {
    height: 62,
    width: 74,
  },
  serviceTitle: {
    ...font("600"),
    color: tokens.color.text,
    fontSize: 14,
    textAlign: "center",
  },
  contentWrap: {
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xl,
    paddingTop: tokens.spacing.lg,
  },
  sectionHeader: {
    marginTop: 2,
  },
  bannerCarouselContent: {
    gap: 12,
    paddingRight: 4,
  },
  bannerSlide: {
    backgroundColor: "transparent",
    borderWidth: 0,
    width: 312,
  },
  hero: {
    backgroundColor: tokens.color.residentShell,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    gap: 4,
  },
  statValue: {
    ...font("800"),
    fontSize: 26,
    color: tokens.color.text,
  },
  statLabel: {
    fontSize: 13,
    color: tokens.color.textMuted,
  },
  quickFacts: {
    gap: 6,
  },
  marketSeriesList: {
    gap: tokens.spacing.sm,
  },
  marketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.sm,
    backgroundColor: tokens.color.surfaceMuted,
  },
  marketSwatch: {
    width: 12,
    height: 12,
    borderRadius: tokens.radius.pill,
  },
  marketCopy: {
    flex: 1,
    gap: 2,
  },
  marketTitle: {
    ...font("700"),
    fontSize: 14,
    color: tokens.color.text,
  },
  marketMeta: {
    ...font("400"),
    fontSize: 12,
    color: tokens.color.textMuted,
  },
  grid: {
    gap: tokens.spacing.sm,
  },
  tile: {
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    backgroundColor: tokens.color.surfaceMuted,
    gap: 6,
  },
  tileEmoji: {
    fontSize: 20,
  },
  tileTitle: {
    ...font("700"),
    fontSize: 16,
    color: tokens.color.text,
  },
  tileBody: {
    ...font("400"),
    fontSize: 13,
    color: tokens.color.textMuted,
  },
});
