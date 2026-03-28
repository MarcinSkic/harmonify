import antfu from '@antfu/eslint-config'
import tailwind from 'eslint-plugin-better-tailwindcss'

export default antfu({
  formatters: true,
  typescript: true,
  vue: true,
  settings: {
    'better-tailwindcss': {
      entryPoint: 'src/assets/tailwind.css',
    },
  },
}, {
  ...tailwind.configs['recommended-error'],
  rules: {
    ...tailwind.configs['recommended-error'].rules,
    'better-tailwindcss/no-unknown-classes': 'off',
  },
})
