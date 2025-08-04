# Internationalization (i18n) Implementation Plan

This document outlines the steps to add English language support to the Werewolf Helper web application.

## Phase 1: Preparation - Extracting Text Resources

The goal of this phase is to separate all user-visible text from the code into centralized language files.

1.  **Create Language Files**:
    *   In the `locales/` directory, create two JSON files:
        *   `zh-CN.json`: To store all existing Chinese text.
        *   `en-US.json`: To store the corresponding English translations.
    *   The files will use a key-value structure. Example:
        ```json
        {
          "appTitle": "狼人杀助手",
          "playerCountLabel": "玩家人数:",
          "startGameButton": "开始游戏"
        }
        ```

2.  **Extract Static Text from HTML**:
    *   Modify `index.html`. Remove all hard-coded Chinese text.
    *   Add a `data-i18n-key` attribute to these HTML elements, with the value corresponding to the key in the JSON files.
    *   Example: `<h1>狼人杀助手</h1>` will become `<h1 data-i18n-key="appTitle"></h1>`.

3.  **Identify Dynamic Text in JavaScript**:
    *   Read through `app.js` to find all dynamically generated strings (e.g., game logs, prompts, modal text).
    *   Add keys for these strings to the language JSON files.

## Phase 2: Implementing the Translation Logic

This phase involves writing the code to load and apply the translations.

1.  **Implement a Language Loader**:
    *   In `app.js`, create a function to asynchronously load the appropriate language JSON file based on a language code (e.g., `en-US`).
    *   Store the loaded language data in a global variable.

2.  **Create a UI Update Function**:
    *   Write a core function that iterates through all elements with a `data-i18n-key` attribute and updates their text content based on the currently loaded language.
    *   For dynamic text in `app.js`, create a translation function `t(key)` that returns the translated string for a given key. All dynamic logs and prompts will use this function.

3.  **Add a Language Switcher**:
    *   Add a language switcher control (e.g., buttons or a dropdown) to `index.html` to allow users to select "中文" or "English".
    *   The switcher will trigger the language loading and UI update logic.

4.  **Implement Automatic Language Detection**:
    *   On initial load, the app will detect the user's preferred language:
        1.  Check `localStorage` for a previously saved user choice.
        2.  If not found, use the browser's language setting (`navigator.language`).
        3.  Default to Chinese if neither is available.

## Phase 3: Translation and Testing

1.  **Translate Content**:
    *   Populate `zh-CN.json` with all the Chinese key-value pairs.
    *   Provide an initial translation for `en-US.json`.
    *   **User Review**: The user will need to review and correct the English translations, especially for game-specific terminology, to ensure accuracy.

2.  **Comprehensive Testing**:
    *   Verify that switching languages correctly updates all static and dynamic text.
    *   Check for any untranslated text.
    *   Ensure the layout is not broken by text of different lengths (English is often longer than Chinese).
