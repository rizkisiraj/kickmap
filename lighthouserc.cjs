module.exports = {
  ci: {
    collect: { url: ['http://localhost:3000/', 'http://localhost:3000/deals', 'http://localhost:3000/compare'], numberOfRuns: 3 },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
      },
    },
  },
};
