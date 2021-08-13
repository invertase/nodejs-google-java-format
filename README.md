# google-java-format

Node repackaging of Google's native [google-java-format](https://github.com/google/google-java-format) tool

Very useful in libraries that wrap native java code in javascript

## Usage Example

1. (optional) `yarn add @invertase/google-java-format` (or `npm -i @invertase/google-java-format` if you prefer)
1. `npx google-java-format <path to java file>`

Please note this wrapper has made the design decision to pass all arguments directly to the underlying tool.
This ensures that we will never have compatibility issues with versions.

The only exception is globbing multiple files, which we must process to not cause errors with command line arguments being too long

### Globbing files

`npx google-java-format -i --glob=folder/**/*.java`

This will run find the matching files and run `google-java-format` on chunks of 30 files at a time, then show the total
formatted files at the end.

See [node-glob](https://github.com/isaacs/node-glob) for globbing semantics.

### Dry-run

To just check files use the `-n` (or `--dry-run`) parameter:

`npx google-java-format -n --glob=folder/**/*.java`

## Integrations

### Pre-commit

May be wrapped in git pre-commit if desired, there are [examples on line](https://github.com/justinludwig/gjfpc-hook) demonstrating this

If you would like to contribute a pre-commit hook, perhaps one that is Husky-compatible, that would be great! Open a PR with the hook and remove this comment 🙏😊

### Github Actions

May be used in GitHub Actions workflows to verify PRs meet formatting standards,
as done in [Invertase](https://invertase.io) [react-native-firebase](https://github.com/Invertase/react-native-firebase/)

## Inspiration

The wonderful [clang-format](https://github.com/angular/clang-format) from the Angular team is so useful, we wanted the same package for java formatting.

That package already solves so many of the little problems that occur with different platforms, and globbing etc - it's fantastic.

Go to [their repo](https://github.com/angular/clang-format), integrate it for objective-c code, and give them a ⭐, they have earned it. Thanks for the code + inspiration Angular community!

## Contributing

- [Issues](https://github.com/invertase/google-java-format/issues)
- [PRs welcome!](https://github.com/invertase/google-java-format/pulls)
- [Code of Conduct](https://github.com/invertase/meta/blob/master/CODE_OF_CONDUCT.md)

## License

- See [LICENSE](/LICENSE)

---

<p align="center">
  <a href="https://invertase.io/?utm_source=readme&utm_medium=footer&utm_campaign=react-native-firebase">
    <img width="75px" src="https://static.invertase.io/assets/invertase/invertase-rounded-avatar.png">
  </a>
  <p align="center">
    Built and maintained by <a href="https://invertase.io/?utm_source=readme&utm_medium=footer&utm_campaign=react-native-firebase">Invertase</a>.
  </p>
</p>
