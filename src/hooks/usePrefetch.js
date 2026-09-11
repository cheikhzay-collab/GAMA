import { useCallback } from 'react';
import { queryCache } from '../services/queryCache';

// ─── Prefetch Map: route → data keys to warm ─────────────────────────────────
// When a user hovers a nav link, prefetch the data that page needs.
const ROUTE_PREFETCH = {
  '/admin/classes':   ['classes_all', 'users_all'],
  '/admin/lessons':   ['lessons_all'],
  '/admin/exams':     ['exams_all'],
  '/admin/dashboard': ['users_all', 'classes_all'],
  '/levels':          ['lessons_all'],
  '/study':           ['exams_all'],
  '/ranking':         ['leaderboard_all'],
};

/**
 * usePrefetch — prefetches data for a route on mouse hover.
 * Call the returned handler in an onMouseEnter on nav links.
 */
export function usePrefetch(route) {
  return useCallback(() => {
    const keys = ROUTE_PREFETCH[route];
    if (!keys) return;

    keys.forEach((key) => {
      const cached = queryCache.getSync(key);
      if (cached) return; // Already in memory

      if (key.startsWith('lessons')) {
        import('../services/lessonService').then(m => {
          queryCache.prefetch(key, () => m.getAllLessons());
        });
      } else if (key.startsWith('class')) {
        import('../services/classService').then(m => {
          queryCache.prefetch(key, () => m.getAllClasses());
        });
      } else if (key.startsWith('users')) {
        import('../services/userService').then(m => {
          queryCache.prefetch(key, () => m.getAllUsers());
        });
      } else if (key.startsWith('exams')) {
        import('../services/examService').then(m => {
          queryCache.prefetch(key, () => m.getAllExams());
        });
      }
    });
  }, [route]);
}

export default usePrefetch;
