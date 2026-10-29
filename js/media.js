// Press room: pre-match pressers and post-match interviews. Answers have a tone the modes turn into
// consequences (confidence, coach/manager trust, fame, teammates).
(function (VB) {
  "use strict";
  var U = VB.ui, esc = U.esc, pick = VB.pick;

  var OUTLETS = ["VOLLEY WEEKLY", "MONTHLY VOLLEYBALL", "SPORTS TODAY", "THE NET REPORT", "COURTSIDE TV", "SPIKE MAGAZINE"];
  var TONE_TXT = { humble: "HUMBLE", confident: "CONFIDENT", fiery: "FIERY", team: "TEAM FIRST" };

  // ctx: { who, team, foe, won, score, rating, big, final, rival, champion }
  function postQuestion(c) {
    var sc = c.score ? c.score[0] + "-" + c.score[1] : "";
    if (c.champion) return { q: "CHAMPIONS! " + c.team + " are on top. What does this moment mean to you?", a: [
      ["team", "This is for every teammate who never gave up."], ["confident", "It's just the beginning for me."], ["fiery", "Remember this night, everyone who doubted us."]] };
    if (c.rival && c.won) return { q: "You beat " + c.rival + " tonight. Is this rivalry yours now?", a: [
      ["humble", c.rival + " pushes me to be better. Respect."], ["confident", "I said I'd beat them. I did."], ["fiery", "They can have the rematch whenever they want."]] };
    if (c.rival && !c.won) return { q: c.rival + " got the better of you tonight. What's your answer?", a: [
      ["humble", "They were better today. I'll learn from it."], ["confident", "Enjoy it. It won't happen again."], ["team", "We'll come back stronger as a team."]] };
    if (c.won && c.rating >= 8) return { q: "You were unstoppable tonight (" + c.rating + "/10). What clicked?", a: [
      ["team", "The sets were perfect — credit to my setter."], ["confident", "I knew from the first point I'd dominate."], ["fiery", "Tell " + c.foe + " to bring more next time."]] };
    if (c.won) return { q: "A " + sc + " win for " + c.team + ". How would you rate your own game?", a: [
      ["humble", "Plenty to improve. I made too many errors."], ["confident", "I'm getting better every single match."], ["team", "Everyone fought for every ball. That's us."]] };
    if (c.rating >= 7) return { q: "You played well, but " + c.team + " lost " + sc + ". Frustrated?", a: [
      ["humble", "We'll watch the video and learn."], ["fiery", "A few calls went against us. Ask the referee."], ["confident", "Next time I'll carry us over the line."]] };
    return { q: "A tough night against " + c.foe + ". What went wrong?", a: [
      ["humble", "I let my team down. I'll fix it in training."], ["confident", "One bad night doesn't define me."], ["fiery", "Ask the coach about the game plan."]] };
  }
  function preQuestion(c) {
    if (c.rival) return { q: "All eyes are on you vs " + c.rival + " today. Any message for them?", a: [
      ["humble", "Respect. May the best player win."], ["confident", "I've been waiting for this one."], ["fiery", "They should be nervous, not me."]] };
    if (c.final) return { q: "A " + c.label + " against " + c.foe + ". Feeling the pressure?", a: [
      ["confident", "Pressure is a privilege. I live for these."], ["humble", "We respect them a lot. We'll give everything."], ["team", "We've trusted each other all season. Nothing changes."]] };
    return { q: "Big match against " + c.foe + " today. What's the plan?", a: [
      ["team", "Play our system and trust each other."], ["confident", "Serve tough, swing big, win."], ["fiery", "Make them regret showing up."]] };
  }
  async function ask(title, c, Q) {
    var outlet = pick(OUTLETS);
    var k = await U.modal("🎤 " + title,
      "<p class='muted'>" + esc(outlet) + " has a microphone in your face.</p><p class='center big'>\"" + esc(Q.q) + "\"</p>",
      Q.a.map(function (x, i) { return { label: "[" + TONE_TXT[x[0]] + "] " + x[1], value: i }; }));
    return { tone: Q.a[k][0], quote: Q.a[k][1], outlet: outlet };
  }
  // the reaction line shown after you answer (each mode adds its own effects text)
  function reaction(r, c, effects) {
    var head = { humble: "Fans love the humility.", confident: "Bold words — now back them up.", fiery: "The quote is all over social media.", team: "Your teammates noticed." }[r.tone];
    return U.modal("📰 " + r.outlet, "<p class='center'>\"" + esc(r.quote) + "\"</p><p class='center'>" + esc(head) + "</p>" + (effects ? "<p class='center gain'>" + esc(effects) + "</p>" : ""),
      [{ label: "CONTINUE", value: 1 }]);
  }

  VB.Media = {
    post: function (c) { return ask(c.champion ? "CHAMPIONS — PRESS ROOM" : "POST-MATCH INTERVIEW", c, postQuestion(c)); },
    pre: function (c) { return ask("PRE-MATCH PRESS", c, preQuestion(c)); },
    reaction: reaction,
    TONE_TXT: TONE_TXT
  };
})(window.VB);
