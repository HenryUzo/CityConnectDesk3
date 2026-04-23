import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, ListRenderItemInfo, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState, InputField, LoadingState } from "../../src/components/ui";
import { RequestCategory } from "../../src/api/contracts";
import { useSession } from "../../src/features/auth/session";
import { ServiceCard } from "../../src/features/resident/ServiceCard";
import { getCategoryKey, getCategoryLabel } from "../../src/features/resident/requestPresentation";
import { getServiceCardDescriptor } from "../../src/features/resident/serviceCardAssets";
import { tokens } from "../../src/theme/tokens";
import { font } from "../../src/theme/typography";

function getCardHeight(cardWidth: number, imageModule: unknown) {
  const asset = Asset.fromModule(imageModule as any);

  if (!asset?.width || !asset?.height) {
    return Math.round(cardWidth * 1.32);
  }

  const naturalHeight = (cardWidth * asset.height) / asset.width;
  return Math.round(naturalHeight);
}

export default function ResidentServicesScreen() {
  const { width } = useWindowDimensions();
  const { services } = useSession();
  const [search, setSearch] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["resident", "categories"],
    queryFn: () => services.resident.categories(),
  });

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    const categories = categoriesQuery.data || [];
    if (!query) return categories;

    return categories.filter((category) => {
      const label = getCategoryLabel(category).toLowerCase();
      const description = String(category.description || "").toLowerCase();
      const key = getCategoryKey(category).toLowerCase();
      return label.includes(query) || description.includes(query) || key.includes(query);
    });
  }, [categoriesQuery.data, search]);

  const gap = 12;
  const horizontalPadding = tokens.spacing.lg;
  const cardWidth = Math.floor((width - horizontalPadding * 2 - gap) / 2);

  const renderCard = ({ item }: ListRenderItemInfo<RequestCategory>) => {
    const descriptor = getServiceCardDescriptor(item);
    const cardHeight = getCardHeight(cardWidth, descriptor.image);

    return (
      <ServiceCard
        width={cardWidth}
        height={cardHeight}
        title={descriptor.title}
        providerCountLabel={descriptor.providerCountLabel}
        locationLabel={descriptor.locationLabel}
        image={descriptor.image}
        onPress={() =>
          router.push({
            pathname: "/(resident)/request-flow",
            params: { categoryKey: getCategoryKey(item) },
          })
        }
      />
    );
  };

  if (categoriesQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState label="Loading services..." />
      </SafeAreaView>
    );
  }

  if (categoriesQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ErrorState
          body="The services catalog could not be loaded from the backend categories endpoint."
          action={
            <Pressable style={styles.retryButton} onPress={() => void categoriesQuery.refetch()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Services</Text>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={20} color={tokens.color.textMuted} />
              <InputField
                placeholder="Search for services"
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No matching services</Text>
            <Text style={styles.emptyBody}>Try another keyword or clear your search to browse all services.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F2F2F2",
  },
  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: 116,
    gap: 14,
  },
  header: {
    gap: 14,
    marginBottom: 10,
  },
  title: {
    ...font("500"),
    color: tokens.color.text,
    fontSize: 22,
    lineHeight: 26,
  },
  searchWrap: {
    alignItems: "center",
    backgroundColor: "#E9EAEC",
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    paddingLeft: 12,
    paddingRight: 8,
  },
  searchInput: {
    backgroundColor: "transparent",
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 0,
  },
  row: {
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  retryButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: tokens.color.primary,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 16,
  },
  retryText: {
    ...font("500"),
    color: "#FFFFFF",
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  emptyTitle: {
    ...font("500"),
    color: tokens.color.text,
    fontSize: 16,
  },
  emptyBody: {
    ...font("400"),
    color: tokens.color.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
