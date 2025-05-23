import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Discussion } from '@/services/api/types';
import { api } from '@/services/api/endpoints';

// Add pagination types
interface PaginationInfo {
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

interface PaginatedDiscussionsResponse {
  items: Discussion[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  requestStatus?: string | null; // Add optional requestStatus field
}

interface DiscussionsState {
  discussions: Discussion[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  selectedDiscussion: Discussion | null;
  // Add pagination state
  pagination: PaginationInfo;
  currentStatus: string | null;
}

const initialState: DiscussionsState = {
  discussions: [],
  loading: false,
  error: null,
  lastFetched: null,
  selectedDiscussion: null,
  pagination: {
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  },
  currentStatus: null,
};

// Only fetch if data is stale (older than 5 minutes)
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

// Updated fetch discussions function to handle pagination
const fetchDiscussionsApi = async (params: {
  status?: string;
  page?: number;
  per_page?: number;
} = {}): Promise<PaginatedDiscussionsResponse> => {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.append('status', params.status);
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());
  
  const response = await fetch(`/api/discussions?${queryParams.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch discussions');
  }
  
  return await response.json();
};

// Update the fetch discussions thunk to handle pagination
export const fetchDiscussions = createAsyncThunk(
  'discussions/fetch',
  async (params: { 
    status?: string; 
    page?: number; 
    per_page?: number; 
    forceRefresh?: boolean 
  } = {}, { getState }) => {
    const { discussions } = getState() as { discussions: DiscussionsState };
    const now = Date.now();
    
    const {
      status = null,
      page = 1,
      per_page = 10,
      forceRefresh = false
    } = params;
    
    // Check if we need to fetch new data
    const needsRefresh = forceRefresh || 
      !discussions.lastFetched || 
      now - discussions.lastFetched > CACHE_TIME ||
      discussions.currentStatus !== status ||
      discussions.pagination.page !== page ||
      discussions.pagination.per_page !== per_page;
    
    // If we have cached data that's still fresh and matches current params, use it
    if (!needsRefresh) {
      return {
        items: discussions.discussions,
        total: discussions.pagination.total,
        page: discussions.pagination.page,
        per_page: discussions.pagination.per_page,
        pages: discussions.pagination.pages,
        requestStatus: status,
      };
    }
    
    // **FIX: Use the updated API method**
    const response = await api.discussions.getAll({
      status: status || undefined,
      page,
      per_page
    });
    
    return {
      ...response,
      requestStatus: status,
    };
  }
);
// Add a new thunk for loading more discussions (for infinite scroll if needed)
export const loadMoreDiscussions = createAsyncThunk(
  'discussions/loadMore',
  async (params: { status?: string } = {}, { getState }) => {
    const { discussions } = getState() as { discussions: DiscussionsState };
    const nextPage = discussions.pagination.page + 1;
    
    // Don't load more if we're already at the last page
    if (nextPage > discussions.pagination.pages) {
      return null;
    }
    
    return await fetchDiscussionsApi({
      status: params.status,
      page: nextPage,
      per_page: discussions.pagination.per_page
    });
  }
);

// Fetch a single discussion by ID
export const fetchDiscussionById = createAsyncThunk(
  'discussions/fetchById',
  async (discussionId: string, { getState, dispatch }) => {
    const { discussions } = getState() as { discussions: DiscussionsState };
    
    // First try to find the discussion in the existing list
    const existingDiscussion = discussions.discussions.find(d => d.id === discussionId);
    
    if (existingDiscussion) {
      return existingDiscussion;
    }
    
    // If not found, fetch from API
    const fetchedDiscussion = await api.discussions.getById(discussionId);
    
    // If the discussions list isn't populated yet, also fetch discussions
    if (discussions.discussions.length === 0) {
      dispatch(fetchDiscussions({}));
    }
    
    return fetchedDiscussion;
  }
);

export const discussionsSlice = createSlice({
  name: 'discussions',
  initialState,
  reducers: {
    setSelectedDiscussion: (state, action: PayloadAction<Discussion | null>) => {
      state.selectedDiscussion = action.payload;
    },
    clearDiscussionCache: (state) => {
      state.lastFetched = null;
    },
    // Add action to update pagination settings
    setPaginationParams: (state, action: PayloadAction<{ page?: number; per_page?: number }>) => {
      const { page, per_page } = action.payload;
      if (page !== undefined) state.pagination.page = page;
      if (per_page !== undefined) state.pagination.per_page = per_page;
    },
    // Add action to reset discussions (useful when changing filters)
    resetDiscussions: (state) => {
      state.discussions = [];
      state.pagination = {
        page: 1,
        per_page: 10,
        total: 0,
        pages: 0,
      };
      state.lastFetched = null;
      state.currentStatus = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDiscussions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDiscussions.fulfilled, (state, action: PayloadAction<PaginatedDiscussionsResponse>) => {
        state.loading = false;
        state.discussions = action.payload.items;
        state.pagination = {
          page: action.payload.page,
          per_page: action.payload.per_page,
          total: action.payload.total,
          pages: action.payload.pages,
        };
        state.lastFetched = Date.now();
        // Store the current status for cache validation
        state.currentStatus = action.payload.requestStatus || null;
      })
      .addCase(fetchDiscussions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch discussions';
      })
      .addCase(loadMoreDiscussions.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadMoreDiscussions.fulfilled, (state, action: PayloadAction<PaginatedDiscussionsResponse | null>) => {
        state.loading = false;
        if (action.payload) {
          // Append new discussions to existing ones
          state.discussions = [...state.discussions, ...action.payload.items];
          state.pagination = {
            page: action.payload.page,
            per_page: action.payload.per_page,
            total: action.payload.total,
            pages: action.payload.pages,
          };
          state.lastFetched = Date.now();
        }
      })
      .addCase(loadMoreDiscussions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load more discussions';
      })
      .addCase(fetchDiscussionById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDiscussionById.fulfilled, (state, action: PayloadAction<Discussion>) => {
        state.loading = false;
        // Update the discussion in the list if it exists
        const index = state.discussions.findIndex(d => d.id === action.payload.id);
        if (index >= 0) {
          state.discussions[index] = action.payload;
        } else {
          // Otherwise add it to the list
          state.discussions.push(action.payload);
          // Update total count
          state.pagination.total += 1;
        }
        // Also set as selected discussion
        state.selectedDiscussion = action.payload;
      })
      .addCase(fetchDiscussionById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch discussion';
      });
  },
});

export const { 
  setSelectedDiscussion, 
  clearDiscussionCache, 
  setPaginationParams,
  resetDiscussions 
} = discussionsSlice.actions;

export default discussionsSlice.reducer;

// Export types for use in components
export type { PaginatedDiscussionsResponse, PaginationInfo };