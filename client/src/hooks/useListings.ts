import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ListingData, PaginatedResponse } from "@shared/types";
import { apiRequest } from "../lib/api";

export interface ListingsQueryParams {
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  condition?: string;
  q?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export function useListings(params: ListingsQueryParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set("category", params.category);
  if (params.minPrice) searchParams.set("minPrice", params.minPrice);
  if (params.maxPrice) searchParams.set("maxPrice", params.maxPrice);
  if (params.condition) searchParams.set("condition", params.condition);
  if (params.q) searchParams.set("q", params.q);
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));

  const qs = searchParams.toString();

  return useQuery<PaginatedResponse<ListingData>>({
    queryKey: ["listings", qs],
    queryFn: () => apiRequest(`/listings${qs ? `?${qs}` : ""}`),
  });
}

export function useListing(id: string) {
  return useQuery<ListingData>({
    queryKey: ["listing", id],
    queryFn: () => apiRequest(`/listings/${id}`),
    enabled: !!id,
  });
}

export function useMyListings() {
  return useQuery<ListingData[]>({
    queryKey: ["my-listings"],
    queryFn: () => apiRequest("/listings/my"),
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ListingData>) =>
      apiRequest<ListingData>("/listings", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    },
  });
}

export function useUpdateListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<ListingData>) =>
      apiRequest<ListingData>(`/listings/${id}`, { method: "PUT", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    },
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/listings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    },
  });
}