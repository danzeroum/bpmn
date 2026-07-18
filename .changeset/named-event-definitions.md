---
'@buildtovalue/core': minor
'@buildtovalue/conformance': patch
---

Named event definitions of first class (Handoff 16 §3a, E-1 — headless).
`diagram.definitions.{messages,signals,errors}[]` stores the OMG root
elements (`bpmn:message`/`bpmn:signal`/`bpmn:error` with `errorCode`);
events reference them via `properties.eventDefinitionRef`, exported as the
standard `messageRef`/`signalRef`/`errorRef` attributes. Undoable CRUD
commands: add (collision-safe auto ids `msg-1`/`sig-1`/`err-1` via
`nextEventDefinitionId`), update (rename cascades to every referencing event
by construction — nodes are never touched — and one undo restores all), and
remove, VETOED by the default rules while referenced, listing every usage.
Import populates the model from root elements; an orphan `*Ref` is
synthesized (`id = name = ref`) WITH an informative warning naming the event
— never silent loss. Round-trip is byte-stable and the additive field keeps
every pre-existing hash and export byte-identical (frozen fixture
`eventDefsFrozen.json`). CONFORMANCE matrix promotes the three root elements;
real-corpus assertion covers `messageRef` files importing without discard.
