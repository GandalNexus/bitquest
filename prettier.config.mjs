/** @type {import("prettier").Config} */
const config = {
  // Largeur de ligne cohérente avec l'usage actuel du projet
  printWidth: 110,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false, // le code utilise déjà les double-quotes partout
  trailingComma: "all", // trailing comma ES5+ (évite les diffs parasites)
  bracketSpacing: true,
  bracketSameLine: false, // JSX closing `>` sur sa propre ligne
  arrowParens: "always", // (x) => x  plutôt que x => x
  endOfLine: "lf",

  // Plugins
  plugins: [],

  // Overrides par type de fichier
  overrides: [
    {
      files: ["*.json", "*.jsonc"],
      options: { printWidth: 80 },
    },
    {
      files: ["*.md", "*.mdx"],
      options: {
        printWidth: 80,
        proseWrap: "always",
      },
    },
    {
      files: ["*.css"],
      options: { singleQuote: false },
    },
  ],
};

export default config;
