export const BUILD_INFO = typeof __APP_BUILD_INFO__ !== 'undefined'
  ? __APP_BUILD_INFO__
  : {
      version: 'dev',
      commit: '',
      branch: '',
      committedAt: '',
      builtAt: '',
    }

export const shortCommitLabel = (commit) => (commit ? commit.slice(0, 7) : 'local')
