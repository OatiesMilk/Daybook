import { test } from "node:test";
import assert from "node:assert/strict";
import { answerHelp, isHelpReply, refusal } from "../apps/web/src/help/domain/answer.ts";
import { canAskModel } from "../apps/web/src/help/domain/model-answer.ts";

const ids = (message: string) => answerHelp(message).sources.map(source => source.id);

test("Help explains Draft with AI instead of denying it", () => {
  for (const question of ["how does the drafting with AI work", "How does Draft with AI work?", "Can Gemini write my DAR activities?", "is my report sent to AI?"]) {
    const reply = answerHelp(question);
    assert.deepEqual(reply.sources.map(source => source.id), ["ai-draft"], question);
    assert.ok(isHelpReply(reply), question);
    assert.match(reply.text, /Draft with AI/);
  }
});

test("requests for Help to write a DAR point to Draft with AI without claiming to do it", () => {
  for (const request of ["can you write my DAR", "please generate my report", "draft my activities", "help me fill in my report"]) {
    const reply = answerHelp(request);
    assert.deepEqual(reply.sources.map(source => source.id), ["ai-draft"], request);
    assert.ok(!reply.text.includes(refusal), request);
    assert.ok(isHelpReply(reply), request);
    assert.equal(canAskModel(request), false, "action requests stay on the deterministic path");
  }
});

test("other report actions are still refused, and existing answers keep working", () => {
  for (const request of ["submit my report", "delete my report", "send my DAR"]) {
    assert.ok(!ids(request).includes("ai-draft"), request);
  }
  assert.deepEqual(ids("how do I create a report"), ["draft"]);
  assert.deepEqual(ids("what can you do"), ["help-capabilities"]);
  assert.deepEqual(ids("how do I record time out?"), ["time-out"]);
  assert.deepEqual(ids("how do I sign out?"), ["account-menu"]);
  assert.deepEqual(ids("how do I switch to dark mode"), ["account-menu"]);
  assert.equal(canAskModel("how does drafting with AI work"), true);
});
