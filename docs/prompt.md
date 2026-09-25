# Prompt

Review the repository sans `graphify-out`; i would like a solutions architect review of the repository; including the readme. 

- architecture review with c4 diagrams levels 1-4 (include class and sequence diagrams
- include details about building and running application locally --> a developer setup guide (that appears to be missing).
- all documents go in the `./docs` folder;

> intent: a take home coding exercise for an architecture role for the company [Stellarus](https://www.stellarus.com/) - creating a new healthcare platform with the backing of California Blue Cross Blue Shield.

## New API Implementation

**target**: docs/architecture-review.md (7. Reference implementation)

**Goal**:

- execute reference implementation
- be sure to `validate` inputs before data operations;
- add unit tests with alternate flows and edge cases.
- implement logging of any errors to an NestJS (Winston logger)

## Authentication & Authorization