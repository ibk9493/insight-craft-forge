
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, mockData } from '../services/api';
import { useAnnotationData } from '../hooks/useAnnotationData';
import { renderHook, act } from '@testing-library/react';

// Mock the API module
vi.mock('../services/api', () => {
  return {
    api: {
      discussions: {
        getAll: vi.fn(),
        getById: vi.fn(),
        getByStatus: vi.fn(),
      },
      annotations: {
        getByDiscussionId: vi.fn(),
        getByTaskAndDiscussion: vi.fn(),
        getUserAnnotation: vi.fn(),
        save: vi.fn(),
      },
      consensus: {
        get: vi.fn(),
        save: vi.fn(),
        calculate: vi.fn(),
      },
    },
    useMockApi: true,
    mockData: {
      discussions: [
        {
          id: 'test1',
          title: 'Test Discussion',
          url: 'https://github.com/org/repo/discussions/123',
          repository: 'org/repo',
          createdAt: '2025-05-01',
          tasks: {
            task1: { status: 'unlocked', annotators: 2 },
            task2: { status: 'locked', annotators: 0 },
            task3: { status: 'locked', annotators: 0 }
          }
        }
      ],
      annotations: [
        {
          discussionId: 'test1',
          userId: 'user1',
          taskId: 1,
          data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
          timestamp: '2025-05-01T00:00:00.000Z'
        },
        {
          discussionId: 'test1',
          userId: 'user2',
          taskId: 1,
          data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
          timestamp: '2025-05-01T00:00:00.000Z'
        },
      ],
      consensus: []
    }
  };
});

// Mock the UserContext
vi.mock('../contexts/UserContext', () => {
  return {
    useUser: () => ({
      isAuthenticated: true,
      user: { id: 'testuser', role: 'annotator' },
      isPodLead: false
    })
  };
});

describe('Consensus calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should correctly determine consensus when all annotators agree', async () => {
    // Mock API response
    api.consensus.calculate.mockResolvedValue({
      result: 'Agreement',
      agreement: true
    });

    // Setup the hook
    const { result } = renderHook(() => useAnnotationData());

    // Call the calculateConsensus method
    let consensusResult;
    await act(async () => {
      consensusResult = await result.current.calculateConsensus('test1', 1);
    });

    // Check that the API was called with the correct parameters
    expect(api.consensus.calculate).toHaveBeenCalledWith('test1', 1);
    
    // Check the returned result
    expect(consensusResult).toEqual({
      result: 'Agreement',
      agreement: true
    });
  });

  it('should correctly determine consensus when annotators disagree', async () => {
    // Mock API response for disagreement
    api.consensus.calculate.mockResolvedValue({
      result: 'No Agreement',
      agreement: false
    });

    // Setup the hook
    const { result } = renderHook(() => useAnnotationData());

    // Call the calculateConsensus method
    let consensusResult;
    await act(async () => {
      consensusResult = await result.current.calculateConsensus('test1', 1);
    });

    // Check that the API was called with the correct parameters
    expect(api.consensus.calculate).toHaveBeenCalledWith('test1', 1);
    
    // Check the returned result
    expect(consensusResult).toEqual({
      result: 'No Agreement',
      agreement: false
    });
  });

  it('should handle errors in consensus calculation gracefully', async () => {
    // Mock API response to throw an error
    api.consensus.calculate.mockRejectedValue({
      message: 'Failed to calculate consensus'
    });

    // Setup the hook
    const { result } = renderHook(() => useAnnotationData());

    // Call the calculateConsensus method and expect it to throw
    await act(async () => {
      await expect(result.current.calculateConsensus('test1', 1)).rejects.toEqual({
        message: 'Failed to calculate consensus'
      });
    });

    // Check that the API was called with the correct parameters
    expect(api.consensus.calculate).toHaveBeenCalledWith('test1', 1);
  });
});
