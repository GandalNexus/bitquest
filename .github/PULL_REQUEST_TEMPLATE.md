name: Pull Request description: Submit changes to BitQuest title: "[TYPE] "
body:

- type: markdown attributes: value: | Thank you for your contribution!

- type: dropdown id: type attributes: label: Type of change description: What
  type of change are you making? options: - feat (new feature) - fix (bug fix) -
  docs (documentation) - style (formatting, style) - refactor (refactoring) -
  test (adding tests) - chore (maintenance) validations: required: true

- type: textarea id: description attributes: label: Description description:
  Describe your changes placeholder: This PR adds/fixes/improves... validations:
  required: true

- type: textarea id: motivation attributes: label: Motivation and context
  description: Why is this change necessary? placeholder: This change is
  necessary because... validations: required: true

- type: textarea id: testing attributes: label: How was it tested? description:
  Describe the tests performed placeholder: | - [ ] Manual test - [ ] Unit
  tests - [ ] Integration tests validations: required: true

- type: input id: issue attributes: label: Linked issue description: Does this
  PR resolve an issue? (e.g. #123) placeholder: "#123"

- type: textarea id: screenshots attributes: label: Screenshots description: If
  applicable, add screenshots placeholder: Drag and drop your images here

- type: checkboxes id: checklist attributes: label: Checklist description:
  Before submitting options: - label: My code follows the project conventions
  required: true - label: I have performed a self-review of my code required:
  true - label: I have commented on complex parts required: false - label: I
  have updated the documentation if necessary required: false - label: My
  changes do not generate new warnings required: true - label: I have tested my
  changes locally required: true - label: Existing tests pass required: true
