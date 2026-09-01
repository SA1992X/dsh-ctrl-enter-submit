# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-27

### Added
- The Ctrl/Cmd+Enter submit / plain-Enter newline behavior now also applies to the **agent question card** (`ask_user_question`):
  - Multiline textarea: plain Enter and Shift+Enter insert a newline, Ctrl/Cmd+Enter advances/submits.
  - Single-line custom-answer input: plain Enter does nothing, Ctrl/Cmd+Enter advances/submits.
  - Option buttons (radio/checkbox): plain Enter no longer selects/advances (avoids accidental submit); mouse click and Space still select, and Ctrl/Cmd+Enter submits once all questions are answered.

## [1.0.1] - 2026-08-27

### Fixed
- Shift+Enter was submitting the message instead of inserting a newline. DSH natively submits on any Enter (including Shift+Enter), so the plugin now intercepts plain Enter **and** Shift+Enter to keep the native textarea newline, while only Ctrl/Cmd+Enter passes through to submit.

## [1.0.0] - 2026-08-26

### Added
- Initial release.
- Plain Enter inserts a newline in the composer.
- Ctrl/Cmd+Enter submits the message.
- `/` and `@` candidate menus keep their native Enter-to-select behavior.
- IME composition is never intercepted.
- Toggle the plugin in **Settings → Plugins** to restore the default Enter-submit behavior.
