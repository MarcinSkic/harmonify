import antfu from '@antfu/eslint-config'
import tailwind from 'eslint-plugin-better-tailwindcss'

export default antfu({
  ignores: ['.claude/**'],
  formatters: true,
  typescript: true,
  vue: true,
  settings: {
    'better-tailwindcss': {
      entryPoint: 'src/assets/tailwind.css',
    },
  },
  rules: {
    'vue/first-attribute-linebreak': 'off',
  },
}, {
  ...tailwind.configs['recommended-error'],
  rules: {
    ...tailwind.configs['recommended-error'].rules,
    'better-tailwindcss/no-unknown-classes': 'off',
    // repo enforces LF via .gitattributes (eol=lf), so this is safe on Windows and Linux alike
    'better-tailwindcss/enforce-consistent-line-wrapping': ['error', { lineBreakStyle: 'unix' }],
  },
})
