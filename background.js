"use strict";

/**
 * Refocus - VALORANT background.js (FOCUS MODE)
 *
 * Requirements from you:
 * - DO NOT break anything that already works (windows, listeners, IDs).
 * - Remove all deaths logic.
 * - Every round (buy phase) show 1 toast (always).
 * - Use Overwolf GEP.
 * - Side-aware (Attacker/Defender)
 * - Sometimes show general "ultimate awareness" (random, not GEP-based)
 *
 * Keeps SAME message IDs:
 * - to in_game window: "toast" payload {type,text,durationMs}
 * - to launcher: "diag", "status_current", "settings_current"
 * - inbound: "status_get"/"request_status", "settings_get"/"request_settings", "settings_update"
 */

var LAUNCHER_WINDOW = "launcher";
var INGAME_WINDOW = "in_game";

var SETTINGS_KEY  = "refocus_settings_v2";
var UNRATED_KEY   = "unrated_messages";
var RATINGS_KEY   = "refocus_ratings";
var VALORANT_GAME_ID = 21640;

// Removed kill/death features completely (focus-only)
var REQUIRED_FEATURES = ["match_info", "me", "game_info"];
var STATUS_POLL_MS = 2000;

var TUNING = {
  gentle: { toastMs: 9000, globalCooldownMs: 0, perMessageCooldownMs: 600000 },
  normal: { toastMs: 10000, globalCooldownMs: 0, perMessageCooldownMs: 600000 },
  strict: { toastMs: 11000, globalCooldownMs: 0, perMessageCooldownMs: 600000 }
};

// ---------------- Toast pools ----------------

var TOASTS_ATTACKER = [
  "Use your kit to clear, not your body.",
  "Push together, not one at a time.",
  "If your teammate dies entry, follow up immediately.",
  "Don't autopilot.",
  "Take map control before committing to a site.",
  "Trade immediately if your entry dies.",
  "Read their economy, adjust your pace.",
  "Don't always commit on the first kill.",
  "Fake a site.",
  "Default first, then see what opens up.",
  "Use utility to make the entry safe.",
  "If mid is open, take it.",
  "Play off your teammate's contact.",
  "Don't dry peek. Set the fight up first.",
];

var TOASTS_DEFENDER = [
  "Play crossfire with your teammate.",
  "Tighter angles are harder to clear.",
  "Make them work for every inch, use your utility.",
  "Time is on your side. Use it.",
  "Don't peek an angle you can hold.",
  "Let them come to you.",
  "Fall back. You can play retake.",
  "Switch your position, be unpredictable.",
  "Hold your angle. Don't go looking for fights.",
  "Fight for space with your teammate.",
  "Use your utility to delay, not just to kill."
];

var TOASTS_ULT_AWARENESS = [
  "Build your plan around who has ultimate.",
  "Expect an ultimate to be used this round.",
  "Watch out for ultimates.",
  "Check the scoreboard. Who has their ult?",
  "If a game-changing ult is up, play around it."
];

// HALFTIME (round 13 only, shown once per match)
var TOASTS_HALFTIME = [
  "New half, reset your mindset.",
  "Forget the last half. Fresh start.",
  "New half. New reads. Stay sharp."
];

// MATCH POINT (round 24)
var TOASTS_MATCH_POINT = [
  "Match point. Stay calm - it's still the same game.",
  "One round. Remember what was working.",
  "Stay composed. That's all.",
  "Pressure is normal. Everyone feels it. Stay sharp."
];

// OVERTIME (rounds 25+)
var TOASTS_OVERTIME = [
  "Overtime. One round at a time.",
  "It's even for a reason. Stay sharp.",
  "One round. Nothing else matters right now.",
  "Overtime goes to the calmer team. Be that team.",
  "Reset. Breathe. One round."
];

// WIN STREAKS (3+ rounds in a row)
var TOASTS_WIN_STREAK = [
  "If something works, don't change it.",
  "Keep doing what you're doing.",
  "Ride the momentum. Stay consistent."
];

// LOSS STREAKS (3+ rounds in a row)
var TOASTS_LOSS_STREAK = [
  "Time to adjust. Try something different.",
  "Change your approach. What you're doing isn't working.",
  "Switch it up - they're reading your patterns."
];

// BIG LEAD (5+ round advantage)
var TOASTS_BIG_LEAD = [
  "Big lead. Don't get sloppy.",
  "Finish strong. No autopilot."
];

// COMEBACK (opponent closes 4+ round gap)
var TOASTS_COMEBACK = [
  "They're coming back. Reset your mental."
];

// CLOSE GAME (11-11, 12-12)
var TOASTS_CLOSE_GAME = [
  "Close game. Every decision matters."
];

// GETTING COMEBACK'D ON (you lose 3+ after big lead)
var TOASTS_COMEBACKD = [
  "Don't panic. Play your game.",
  "Reset. Remember what was working earlier."
];

// ---- AGENT-SPECIFIC POOLS ----
// Duelists
var TOASTS_AGENT_JETT_ATK = ["Dash is your exit. Don't entry without it.", "Take one duel, then reposition. Don't farm the same angle.", "Smoke + dash > dry swing.", "Clear close before dashing deep.", "If you died first: next round wait half a second for trade."];
var TOASTS_AGENT_JETT_DEF = ["Op angle + dash escape. Don't overstay.", "Take contact, fall back, re-peek from new spot.", "If they rush: stall, don't hero swing.", "Play off sound, not ego.", "One pick is enough. Live."];
var TOASTS_AGENT_REYNA_ATK = ["Isolate 1v1s. Don't swing into two.", "Kill, dismiss, reset. Don't chain fights blindly.", "Play near trade range.", "If blind missed, don't force the swing.", "Slow your first bullets."];
var TOASTS_AGENT_REYNA_DEF = ["Hold tight angle. Force them into you.", "Take first contact, dismiss out.", "Don't overheat after first kill.", "If they rush: back up and re-fight.", "You don't need to peek twice."];
var TOASTS_AGENT_RAZE_ATK = ["Utility clears space. Use it before swinging.", "Boombot first, body second.", "Satchel with timing, not alone.", "Stop dry clearing tight corners.", "Ult = secure site, not montage."];
var TOASTS_AGENT_RAZE_DEF = ["Nade on contact, not after plant.", "Delay > damage.", "Play off sound cues.", "If overwhelmed: fall back, don't commit.", "You're strongest stalling."];
var TOASTS_AGENT_PHOENIX_ATK = ["Flash and swing immediately.", "Wall to cross, not to hide.", "Ult for entry info.", "Heal only when safe.", "Don't re-peek without flash."];
var TOASTS_AGENT_PHOENIX_DEF = ["Flash through choke on sound.", "Play anti-rush, not hero.", "Use molly to deny plant.", "After first duel, reposition.", "Short fights favor you."];
var TOASTS_AGENT_NEON_ATK = ["Speed with team, not ahead of them.", "Slide after contact.", "Stun before swing.", "Clear close before sprint.", "Pause. Aim. Then shoot."];
var TOASTS_AGENT_NEON_DEF = ["Take info space early, fall back.", "Stun rush lanes.", "Don't over-rotate instantly.", "Play hit-and-run.", "Live after first fight."];
// Initiators
var TOASTS_AGENT_SOVA_ATK = ["Recon before entry.", "Drone for first contact.", "Call what you see.", "Don't peek if arrow missed.", "Shock to clear corners."];
var TOASTS_AGENT_SOVA_DEF = ["Early recon for info.", "Drone on retake.", "Hold until arrow lands.", "Don't ego peek without info.", "Ult for delay."];
var TOASTS_AGENT_SKYE_ATK = ["Flash for team swing.", "Dog clears close.", "Pop flash fast.", "Trade your entry.", "Heal after control."];
var TOASTS_AGENT_SKYE_DEF = ["Flash choke on sound.", "Play second contact.", "Dog before re-peek.", "Retake with flash.", "Enable, don't entry."];
var TOASTS_AGENT_BREACH_ATK = ["Stun then explode.", "Flash through wall, swing instantly.", "Don't solo entry.", "Call your timing.", "Ult to break site hold."];
var TOASTS_AGENT_BREACH_DEF = ["Stun rush instantly.", "Flash for retake.", "Delay, don't duel first.", "Play behind cover.", "Use one piece at a time."];
// Controllers
var TOASTS_AGENT_OMEN_ATK = ["Smoke for entry, not comfort.", "Paranoia = go signal.", "Teleport after pressure.", "Lurk with timing.", "Don't waste last smoke."];
var TOASTS_AGENT_OMEN_DEF = ["Early smoke slows rush.", "Play inside your smoke smartly.", "Reposition after contact.", "Paranoia retake swing.", "Anchor and live."];
var TOASTS_AGENT_BRIMSTONE_ATK = ["Smokes down = move.", "Molly for plant.", "Stim before swing.", "Save one smoke post-plant.", "Don't die before execute."];
var TOASTS_AGENT_BRIMSTONE_DEF = ["Smoke choke on sound.", "Molly stops plant.", "Ult deny spike.", "Delay first.", "Anchor safe."];
var TOASTS_AGENT_VIPER_ATK = ["Wall for cross.", "Turn wall off to punish.", "Orb for plant.", "Don't waste fuel.", "Plan before barrier drops."];
var TOASTS_AGENT_VIPER_DEF = ["Wall stall rush.", "Play decay advantage.", "Orb choke early.", "Ult to anchor.", "Live for retake."];
// Sentinels
var TOASTS_AGENT_KILLJOY_ATK = ["Utility holds flank.", "Don't entry first.", "Play off alarmbot.", "Ult for site take.", "Stay near setup."];
var TOASTS_AGENT_KILLJOY_DEF = ["Anchor deeper.", "Let turret make contact.", "Don't peek before trigger.", "Delay, not duel.", "Move setup each round."];
var TOASTS_AGENT_CYPHER_ATK = ["Trip flank.", "Don't lurk too far.", "Cage to isolate.", "Trade entry.", "Info before push."];
var TOASTS_AGENT_CYPHER_DEF = ["Play off trip contact.", "Move one trip every round.", "Cage on rush.", "Delay and call.", "Stay alive."];
var TOASTS_AGENT_SAGE_ATK = ["Wall for plant.", "Heal after control.", "Don't entry.", "Slow for post-plant.", "Play safe with revive."];
var TOASTS_AGENT_SAGE_DEF = ["Wall early delay.", "Slow rush lanes.", "Play deep.", "Don't hero peek.", "Retake calm."];
// Duelists (continued)
var TOASTS_AGENT_YORU_ATK = ["Fake once, commit once.", "Flash and swing.", "Teleport with plan.", "Don't over-trick."];
var TOASTS_AGENT_YORU_DEF = ["Unexpected off-angles.", "Fake pressure.", "Reposition often.", "Change pattern."];
var TOASTS_AGENT_ISO_ATK = ["Take clean 1v1.", "Shield before fight.", "Isolate first.", "Trade properly."];
var TOASTS_AGENT_ISO_DEF = ["Hold tight angle.", "Take duel, reset.", "Don't chase.", "Anchor calmly."];
var TOASTS_AGENT_WAYLAY_ATK = ["Hit fast, exit fast.", "Keep escape ready.", "Time with team.", "Don't overstay."];
var TOASTS_AGENT_WAYLAY_DEF = ["Disrupt then fall back.", "Punish overpush.", "Hold crossfire.", "Control tempo."];
// Controllers (continued)
var TOASTS_AGENT_ASTRA_ATK = ["Stars first, execute second.", "Smoke down means go.", "Pull must create a swing.", "Don't waste all utility early."];
var TOASTS_AGENT_ASTRA_DEF = ["Stall with one star, not three.", "Delay, then fall back.", "Play off gravity well contact.", "Live to reactivate."];
var TOASTS_AGENT_CLOVE_ATK = ["Smoke to isolate.", "Fight near a teammate.", "Decay before commit.", "Stay useful after death."];
var TOASTS_AGENT_CLOVE_DEF = ["Early smoke slows rush.", "Trade, don't solo hold.", "Anchor one lane.", "Support even after death."];
var TOASTS_AGENT_HARBOR_ATK = ["Wall to cross safely.", "Move with your utility.", "Cove secures plant.", "Cut vision, then clear."];
var TOASTS_AGENT_HARBOR_DEF = ["Wall to stall.", "Delay before fighting.", "Play off slowed contact.", "Retake together."];
// Sentinels (continued)
var TOASTS_AGENT_CHAMBER_ATK = ["One pick, then reset.", "Trap flank early.", "Don't re-peek.", "Play trade range."];
var TOASTS_AGENT_CHAMBER_DEF = ["Shoot once, reposition.", "Escape plan ready.", "Delay rush.", "Live after first kill."];
var TOASTS_AGENT_DEADLOCK_ATK = ["Split site with wall.", "Isolate one target.", "Don't entry first.", "Force 2v1."];
var TOASTS_AGENT_DEADLOCK_DEF = ["Play behind sensors.", "Let them trigger.", "Delay push.", "Control space."];
var TOASTS_AGENT_VYSE_ATK = ["Trap for isolation.", "Blind with swing.", "Create unfair fights.", "Reset after contact."];
var TOASTS_AGENT_VYSE_DEF = ["Trap common entry.", "Punish first contact.", "Hold tight.", "Delay push."];
// Initiators (continued — Fade, Gekko, Tejo, KAY/O)
var TOASTS_AGENT_FADE_ATK = ["Haunt first, swing second.", "Clear one area fully.", "Don't peek without info.", "Seize must create a fight.", "Trade your entry."];
var TOASTS_AGENT_FADE_DEF = ["Early reveal slows push.", "Play off scan contact.", "Don't re-peek blind.", "Save one piece for retake.", "Info before fight."];
var TOASTS_AGENT_GEKKO_ATK = ["Send Wingman first.", "Plant safely with Cove.", "Use utility to force movement.", "Pick up your buddies.", "Don't entry alone."];
var TOASTS_AGENT_GEKKO_DEF = ["Wingman for retake pressure.", "Play off Dizzy contact.", "Delay with Mosh.", "Stay tradable.", "Utility first, duel second."];
var TOASTS_AGENT_TEJO_ATK = ["Drone before commit.", "Strike to clear ground.", "Don't guess positions.", "Create pressure, then hit.", "Move with info."];
var TOASTS_AGENT_TEJO_DEF = ["Drone early for numbers.", "Disrupt before they plant.", "Play off utility impact.", "Delay with structure.", "Anchor patiently."];
var TOASTS_AGENT_KAYO_ATK = ["Knife before you swing.", "Flash = instant peek.", "Suppress then commit.", "Don't entry without utility.", "Call suppressed targets.", "Trade your duelist.", "Ult with your team, not alone.", "Clear close with molly."];
var TOASTS_AGENT_KAYO_DEF = ["Early knife for info.", "Flash choke on contact.", "Suppress rush, then fall back.", "Delay before fighting.", "Don't ego peek without info.", "Ult to stop execute.", "Play second contact.", "Live after first fight."];
// Sentinels (Veto — internal ID unknown, to be mapped when discovered)
var TOASTS_AGENT_VETO_ATK = ["Deny enemy utility.", "Isolate one lane.", "Don't overextend.", "Play structured."];
var TOASTS_AGENT_VETO_DEF = ["Control choke.", "Utility before duel.", "Anchor site.", "Play for time."];

// Agent → pool lookup (only agents with tips in the PDF)
var AGENT_POOLS = {
  "Jett":      { atk: TOASTS_AGENT_JETT_ATK,      def: TOASTS_AGENT_JETT_DEF },
  "Reyna":     { atk: TOASTS_AGENT_REYNA_ATK,     def: TOASTS_AGENT_REYNA_DEF },
  "Raze":      { atk: TOASTS_AGENT_RAZE_ATK,      def: TOASTS_AGENT_RAZE_DEF },
  "Phoenix":   { atk: TOASTS_AGENT_PHOENIX_ATK,   def: TOASTS_AGENT_PHOENIX_DEF },
  "Neon":      { atk: TOASTS_AGENT_NEON_ATK,      def: TOASTS_AGENT_NEON_DEF },
  "Sova":      { atk: TOASTS_AGENT_SOVA_ATK,      def: TOASTS_AGENT_SOVA_DEF },
  "Skye":      { atk: TOASTS_AGENT_SKYE_ATK,      def: TOASTS_AGENT_SKYE_DEF },
  "Breach":    { atk: TOASTS_AGENT_BREACH_ATK,    def: TOASTS_AGENT_BREACH_DEF },
  "Omen":      { atk: TOASTS_AGENT_OMEN_ATK,      def: TOASTS_AGENT_OMEN_DEF },
  "Brimstone": { atk: TOASTS_AGENT_BRIMSTONE_ATK, def: TOASTS_AGENT_BRIMSTONE_DEF },
  "Viper":     { atk: TOASTS_AGENT_VIPER_ATK,     def: TOASTS_AGENT_VIPER_DEF },
  "Killjoy":   { atk: TOASTS_AGENT_KILLJOY_ATK,   def: TOASTS_AGENT_KILLJOY_DEF },
  "Cypher":    { atk: TOASTS_AGENT_CYPHER_ATK,    def: TOASTS_AGENT_CYPHER_DEF },
  "Sage":      { atk: TOASTS_AGENT_SAGE_ATK,      def: TOASTS_AGENT_SAGE_DEF },
  "Yoru":      { atk: TOASTS_AGENT_YORU_ATK,      def: TOASTS_AGENT_YORU_DEF },
  "Iso":       { atk: TOASTS_AGENT_ISO_ATK,        def: TOASTS_AGENT_ISO_DEF },
  "Waylay":    { atk: TOASTS_AGENT_WAYLAY_ATK,     def: TOASTS_AGENT_WAYLAY_DEF },
  "Astra":     { atk: TOASTS_AGENT_ASTRA_ATK,      def: TOASTS_AGENT_ASTRA_DEF },
  "Clove":     { atk: TOASTS_AGENT_CLOVE_ATK,      def: TOASTS_AGENT_CLOVE_DEF },
  "Harbor":    { atk: TOASTS_AGENT_HARBOR_ATK,     def: TOASTS_AGENT_HARBOR_DEF },
  "Chamber":   { atk: TOASTS_AGENT_CHAMBER_ATK,    def: TOASTS_AGENT_CHAMBER_DEF },
  "Deadlock":  { atk: TOASTS_AGENT_DEADLOCK_ATK,   def: TOASTS_AGENT_DEADLOCK_DEF },
  "Vyse":      { atk: TOASTS_AGENT_VYSE_ATK,       def: TOASTS_AGENT_VYSE_DEF },
  "Fade":      { atk: TOASTS_AGENT_FADE_ATK,        def: TOASTS_AGENT_FADE_DEF },
  "Gekko":     { atk: TOASTS_AGENT_GEKKO_ATK,       def: TOASTS_AGENT_GEKKO_DEF },
  "Tejo":      { atk: TOASTS_AGENT_TEJO_ATK,        def: TOASTS_AGENT_TEJO_DEF },
  "KAYO":      { atk: TOASTS_AGENT_KAYO_ATK,        def: TOASTS_AGENT_KAYO_DEF },
  "Veto":      { atk: TOASTS_AGENT_VETO_ATK,        def: TOASTS_AGENT_VETO_DEF }  // internal ID unknown — update resolver when discovered
};

// BONUS ROUND (round 3 / round 15 — won pistol + eco, now deciding whether to full buy)
var TOASTS_BONUS_ROUND = [
  "Bonus round — save for the full buy if you can.",
  "Keep your gun if it's good enough. Don't over-spend.",
  "Check your credits. Can you full buy next round?",
  "Bonus round. Make sure your team is on the same page.",
  "Don't force if it risks your full buy next round.",
  "Play for the save if you can't full buy next round.",
  "Bonus round — coordinate with your team on the buy.",
];

// ---------------- State ----------------
var launcherId = null;
var inGameId = null;

var DEFAULT_SETTINGS = { overlayEnabled: true, position: "tr", intensity: "normal", devMode: false };
var settings = loadSettings();

var lastToastAt = 0;
var messageLastShown = {};

var eventsOk = false;
var gepRequestedOk = false;
var gepSeenAnyUpdate = false;
var lastGepUpdateAt = 0;
var GEP_STREAMING_MS = 5000;

var valorantRunning = false;
var valorantFocused = false;

var detectedGameId = null;
var detectedInstanceId = null;

var lastStatusSig = "";
var lastRunningSig = "";

var cachedGameResolution = null; // { W, H } cached from getRunningGameInfo

// Focus/launch logic (RUNNING toast)
var hasPolledOnce = false;
var valorantSessionId = 0;
var runningToastShownForSession = false;

var lastKnownIsValo = false;
var lastKnownValoAt = 0;
var VALO_STICKY_MS = 3500;

// Match / round info
var lastRoundNumber = null;
var lastToastRoundNumber = null;
var lastKnownRound = null;
var lastKnownPhase = null;

var lastMatchId = null;
var lastMapId = null;

// "me" snapshot
var meTeam = null;              // "blue"/"red"/etc (used for side detection fallback)

// Side detection (prefer match_info.team; fallback roster teamId)
var matchTeamSide = null;        // 'atk'|'def' from match_info.team
var localTeamId = null;          // 0|1 from roster local player
var localPlayerAgent = null;     // e.g. "Jett", "Viper" — from me.agent or roster character

// Special round flags (reset per match)
var halftimeShownForMatch = false;   // true once round 13 halftime toast fires
var overtimeAnnouncedRound = null;   // round number of last overtime toast
var stackedToastShownForRounds = {}; // { 1: true, 13: true } — "Try stacking a site." on first def round loss

// Score tracking (for win/loss streaks and momentum detection)
var myScore = { won: 0, lost: 0 };         // Our team's score
var enemyScore = { won: 0, lost: 0 };      // Enemy team's score
var lastScoreWon = 0;                      // Last known won count
var lastScoreLost = 0;                     // Last known lost count
var currentStreak = 0;                     // Positive = win streak, negative = loss streak
var peakLead = 0;                          // Largest lead we've had this match
var peakDeficit = 0;                       // Largest deficit we've faced this match

// Per-category cooldown tracker (prevents same category back-to-back)
var categoryLastShown = {};

var gepRetryTimer = null;                  // Timer reference for GEP retry (moved here from GEP section)
var valorantRunningSince = 0;              // When valorantRunning became true (for GEP stale detection)
var lastGepRerequestAt = 0;                // Last time we re-requested GEP due to no data
var agentPollTimer = null;                 // Interval timer for agent detection retry (while agent unknown)

// Messages shown this gaming session (for post-game rating)
var sessionMessages = [];

// ---------------- Utils ----------------
function nowMs() { return Date.now(); }
function safeJsonParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

function parseMaybeJson(v) {
  if (typeof v !== "string") return v;
  var t = v.trim();
  if (!t) return v;
  if (
    (t.charAt(0) === "{" && t.charAt(t.length - 1) === "}") ||
    (t.charAt(0) === "[" && t.charAt(t.length - 1) === "]")
  ) {
    var j = safeJsonParse(t);
    return j !== null ? j : v;
  }
  return v;
}

function getSenderWindowId(e) {
  if (!e) return null;
  if (e.source && e.source.id) return e.source.id;
  if (e.sourceWindowId) return e.sourceWindowId;
  if (e.sender && e.sender.id) return e.sender.id;
  return null;
}

function sendMessageSafe(winId, msgId, payload) {
  try {
    if (!winId) return;
    overwolf.windows.sendMessage(winId, msgId, payload || {}, function () {});
  } catch (e) {}
}

function sendToLauncher(targetLauncherId, msgId, payload) {
  var id = targetLauncherId || launcherId;
  if (!id) return;
  sendMessageSafe(id, msgId, payload);
}

// Logging policy
function diagInfo(msg, targetLauncherId) {
  try { console.log("[Refocus]", msg); } catch (e) {}
  sendToLauncher(targetLauncherId, "diag", { msg: msg });
}
function diagDebug(msg, targetLauncherId) {
  if (!settings.devMode) return;
  try { console.log("[Refocus]", msg); } catch (e) {}
  sendToLauncher(targetLauncherId, "diag", { msg: msg });
}

// ---------------- Settings ----------------
function loadSettings() {
  try {
    var raw = localStorage.getItem(SETTINGS_KEY);
    var j = raw ? safeJsonParse(raw) : null;
    var out = {
      overlayEnabled: DEFAULT_SETTINGS.overlayEnabled,
      position: DEFAULT_SETTINGS.position,
      intensity: DEFAULT_SETTINGS.intensity,
      devMode: DEFAULT_SETTINGS.devMode
    };
    if (j) {
      if (typeof j.overlayEnabled === "boolean") out.overlayEnabled = j.overlayEnabled;
      if (j.position) out.position = j.position;
      if (j.intensity) out.intensity = j.intensity;
      if (typeof j.devMode === "boolean") out.devMode = j.devMode;
    }
    return out;
  } catch (e) {
    return {
      overlayEnabled: DEFAULT_SETTINGS.overlayEnabled,
      position: DEFAULT_SETTINGS.position,
      intensity: DEFAULT_SETTINGS.intensity,
      devMode: DEFAULT_SETTINGS.devMode
    };
  }
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}

function pushSettingsToLauncher(targetLauncherId) {
  sendToLauncher(targetLauncherId, "settings_current", settings);
}

// ---------------- Toast selection ----------------
function tuning() {
  var key = String(settings.intensity || "normal").toLowerCase();
  return TUNING[key] || TUNING.normal;
}

function pickRandomMessage(list, perMessageCooldownMs) {
  var now = nowMs();
  var allowed = [];
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if ((now - (messageLastShown[m] || 0)) >= perMessageCooldownMs) allowed.push(m);
  }
  var pool = allowed.length ? allowed : list;

  // Weighted selection by local rating score (up - down)
  var ratings = loadRatings();
  var weighted = [];
  for (var j = 0; j < pool.length; j++) {
    var msg   = pool[j];
    var entry = ratings[msg];
    var score = entry ? (entry.up - entry.down) : 0;
    var w = score <= -2 ? 0 : score === 0 ? 1 : score === 1 ? 2 : 3;
    for (var k = 0; k < w; k++) weighted.push(msg);
  }
  // Fallback: all messages disliked — use unweighted cooldown pool
  if (weighted.length === 0) weighted = pool;
  // Final fallback: use full list
  if (weighted.length === 0) weighted = list;
  return weighted[Math.floor(Math.random() * weighted.length)];
}

// Pick from a category with both a category-level cooldown AND per-message cooldown.
// categoryKey: string label for the category (e.g. "atk", "def", "ult_awareness")
// categoryCooldownMs: how long before this whole category can fire again (0 = no limit)
function pickFromCategory(list, categoryKey, categoryCooldownMs, perMessageCooldownMs) {
  if (categoryCooldownMs > 0) {
    var now = nowMs();
    var catLast = categoryLastShown[categoryKey] || 0;
    if ((now - catLast) < categoryCooldownMs) return null; // category on cooldown
  }
  return pickRandomMessage(list, perMessageCooldownMs);
}

function markCategoryShown(categoryKey) {
  categoryLastShown[categoryKey] = nowMs();
}

function markMessageShown(msg) {
  var now = nowMs();
  messageLastShown[msg] = now;
  lastToastAt = now;
}

function recordSessionMessage(text, category, roundNumber) {
  var side = getSideForRound(roundNumber);
  var scoreStr = myScore.won + "-" + myScore.lost;
  sessionMessages.push({
    messageText: text,
    messageCategory: category,
    roundNumber: roundNumber,
    currentScore: scoreStr,
    currentStreak: currentStreak,
    userSide: side,
    timestamp: new Date().toISOString(),
    appVersion: "0.4.0"
  });
}

function loadRatings() {
  try {
    var raw = localStorage.getItem(RATINGS_KEY);
    return raw ? (safeJsonParse(raw) || {}) : {};
  } catch (e) { return {}; }
}

function saveRatingLocal(messageText, vote) {
  try {
    var ratings = loadRatings();
    if (!ratings[messageText]) ratings[messageText] = { up: 0, down: 0 };
    if (vote === 1)  ratings[messageText].up   += 1;
    if (vote === -1) ratings[messageText].down += 1;
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
  } catch (e) {}
}

function getGameSizeFallback() { return { W: 1920, H: 1080 }; }

// ---------------- Toast window positioning ----------------
function positionToastWindow(done) {
  if (!inGameId) { if (done) done(); return; }

  var sz = cachedGameResolution || getGameSizeFallback();
  var W = sz.W, H = sz.H;

  var toastW = 420, toastH = 160;
  var marginX = 18, marginY = 18;

  var pos = String(settings.position || "tr").toLowerCase();
  var x = marginX, y = marginY;

  if (pos === "tr") { x = Math.max(10, W - toastW - marginX); y = marginY; }
  else if (pos === "tl") { x = marginX; y = marginY; }
  else if (pos === "br") { x = Math.max(10, W - toastW - marginX); y = Math.max(10, H - toastH - marginY); }
  else if (pos === "bl") { x = marginX; y = Math.max(10, H - toastH - marginY); }

  try {
    overwolf.windows.changePosition(inGameId, x, y, function () {
      if (done) done();
    });
  } catch (e) { if (done) done(); }
}

function showToast(type, text, durationMs) {
  if (!settings.overlayEnabled) return;
  if (!inGameId) return;

  positionToastWindow(function () {
    try {
      overwolf.windows.restore(inGameId, function () {
        overwolf.windows.bringToFront(inGameId, function () {
          // IMPORTANT: keep same message id + payload
          sendMessageSafe(inGameId, "toast", { type: type, text: text, durationMs: durationMs });
        });
      });
    } catch (e) {}
  });
}

// ---------------- Status ----------------
function sendStatusToLauncher(targetLauncherId, force) {
  var streaming = gepSeenAnyUpdate && (nowMs() - lastGepUpdateAt < GEP_STREAMING_MS);

  var st = {
    valorantRunning: valorantRunning,
    valorantFocused: valorantFocused,
    eventsOk: eventsOk,
    gepRequestedOk: gepRequestedOk,
    gepStreaming: streaming,
    detectedGameId: detectedGameId,
    detectedInstanceId: detectedInstanceId
  };

  var sig = JSON.stringify(st);
  if (!force && sig === lastStatusSig) return;
  lastStatusSig = sig;

  sendToLauncher(targetLauncherId, "status_current", st);
}

// ---------------- Resets ----------------
function resetMatchState(reason) {
  lastRoundNumber = null;
  lastToastRoundNumber = null;
  lastKnownRound = null;
  lastKnownPhase = null;

  lastMatchId = null;
  lastMapId = null;

  meTeam = null;
  matchTeamSide = null;
  localTeamId = null;

  diagDebug("Reset match state: " + reason);
}

function resetForNewMatch(reason) {
  // Flush this match's messages to localStorage immediately so they appear
  // in the launcher as soon as the match ends (not when the game process closes).
  // Also handles multi-game accumulation — player can queue matches without
  // opening the launcher between games.
  saveSessionMessages();

  lastToastRoundNumber = null;
  lastRoundNumber = null;
  lastKnownRound = null;
  lastKnownPhase = null;

  meTeam = null;
  matchTeamSide = null;
  localTeamId = null;
  localPlayerAgent = null;
  stopAgentPoll();

  halftimeShownForMatch = false;
  overtimeAnnouncedRound = null;
  stackedToastShownForRounds = {};

  // Reset score tracking
  myScore = { won: 0, lost: 0 };
  enemyScore = { won: 0, lost: 0 };
  lastScoreWon = 0;
  lastScoreLost = 0;
  currentStreak = 0;
  peakLead = 0;
  peakDeficit = 0;

  diagInfo("NEW MATCH reset ✅ (" + reason + ")");
}

// ---------------- Game detection ----------------
function normalizeInstanceToClassId(instanceId) {
  if (!instanceId || typeof instanceId !== "number") return null;
  return Math.floor(instanceId / 10);
}

function isValorantFromInfo(info) {
  var cid = (info && typeof info.classId === "number") ? info.classId : null;
  var iid = (info && typeof info.id === "number") ? info.id : null;

  if (cid === VALORANT_GAME_ID) return true;
  if (cid !== null && cid !== VALORANT_GAME_ID) return false;

  var norm = normalizeInstanceToClassId(iid);
  if (norm === VALORANT_GAME_ID) return true;

  var t = nowMs();
  if (lastKnownIsValo && (t - lastKnownValoAt) < VALO_STICKY_MS) return true;

  return false;
}

function pollGameStatus() {
  try {
    overwolf.games.getRunningGameInfo(function (info) {
      if (!info || !info.isRunning) {
        if (valorantRunning) {
          // Game just closed - save messages for rating
          saveSessionMessages();
        }

        valorantRunning = false;
        valorantFocused = false;
        valorantRunningSince = 0;
        lastGepRerequestAt = 0;
        detectedGameId = null;
        detectedInstanceId = null;

        gepSeenAnyUpdate = false;
        lastGepUpdateAt = 0;

        runningToastShownForSession = false;

        // Cancel any pending GEP retry - game is gone
        if (gepRetryTimer) { clearTimeout(gepRetryTimer); gepRetryTimer = null; }

        resetMatchState("game_not_running");
        sendStatusToLauncher();

        hasPolledOnce = true;
        lastKnownIsValo = false;
        return;
      }

      detectedInstanceId = info.id || null;

      // Cache game resolution for accurate toast positioning
      if (typeof info.width === "number" && info.width > 0 &&
          typeof info.height === "number" && info.height > 0) {
        cachedGameResolution = { W: info.width, H: info.height };
      }

      var normCid = normalizeInstanceToClassId(info.id);
      detectedGameId = (typeof info.classId === "number") ? info.classId : normCid;

      var isValo = isValorantFromInfo(info);
      var isInFocus = !!info.isInFocus;

      if (isValo) {
        lastKnownIsValo = true;
        lastKnownValoAt = nowMs();
      } else {
        if ((nowMs() - lastKnownValoAt) > VALO_STICKY_MS) lastKnownIsValo = false;
      }

      if (isValo && !valorantRunning) {
        valorantSessionId += 1;
        valorantRunningSince = nowMs();
        runningToastShownForSession = false;
        diagDebug("Valorant launch detected -> session " + valorantSessionId);
        // Re-request GEP when Valorant starts - fixes detection when app started before game
        setRequiredFeatures();
      }

      if (isValo && valorantRunningSince === 0) valorantRunningSince = nowMs();

      valorantRunning = isValo;
      valorantFocused = isValo && isInFocus;

      // RUNNING toast once per Valorant launch, ONLY when focused
      if (valorantRunning && valorantFocused && !runningToastShownForSession) {
        if (hasPolledOnce) {
          runningToastShownForSession = true;
          if (settings.overlayEnabled) showToast("INFO", "Refocus: RUNNING ✅", 3200);
          diagInfo("RUNNING ✅ (toast shown once per launch)");
        }
      }

      var sig =
        String(detectedGameId || "?") + "|" +
        String(detectedInstanceId || "?") + "|" +
        (valorantRunning ? "YES" : "NO") + "|" +
        (valorantFocused ? "FOCUS" : "BG") + "|" +
        String(valorantSessionId);

      if (sig !== lastRunningSig) {
        lastRunningSig = sig;
        diagDebug(
          "RunningGameInfo: classId=" + (detectedGameId || "?") +
          " instance=" + (detectedInstanceId || "?") +
          " valorant=" + (valorantRunning ? "YES" : "NO") +
          " focus=" + (valorantFocused ? "YES" : "NO") +
          " session=" + valorantSessionId
        );
      }

      // If in Valorant but no GEP data for 12s, re-request features (fixes "in match but GEP didn't connect")
      if (valorantRunning && !gepSeenAnyUpdate && valorantRunningSince > 0) {
        var now = nowMs();
        var elapsed = now - valorantRunningSince;
        var sinceLastRereq = now - lastGepRerequestAt;
        if (elapsed >= 12000 && sinceLastRereq >= 15000) {
          lastGepRerequestAt = now;
          diagInfo("GEP no data after 12s - re-requesting features");
          setRequiredFeatures();
        }
      }

      sendStatusToLauncher();
      hasPolledOnce = true;
    });
  } catch (e) {
    diagInfo("pollGameStatus ERROR: " + (e && e.message ? e.message : String(e)));
  }
}

// ---------------- GEP ----------------
var GEP_RETRY_MS = 5000;   // retry every 5 seconds on failure

function setRequiredFeatures() {
  // Clear any pending retry before attempting
  if (gepRetryTimer) { clearTimeout(gepRetryTimer); gepRetryTimer = null; }

  try {
    overwolf.games.events.setRequiredFeatures(REQUIRED_FEATURES, function (res) {
      if (!res || !res.success) {
        gepRequestedOk = false;
        eventsOk = false;
        sendStatusToLauncher();
        var errMsg = (res && res.error ? res.error : "unknown");
        diagInfo("setRequiredFeatures FAILED (" + errMsg + ") - retrying in " + (GEP_RETRY_MS / 1000) + "s");
        // Auto-retry: GEP often fails in lobby, succeeds once match starts
        gepRetryTimer = setTimeout(function () {
          if (valorantRunning) setRequiredFeatures();
        }, GEP_RETRY_MS);
      } else {
        gepRequestedOk = true;
        sendStatusToLauncher();
        diagInfo("setRequiredFeatures OK ✅");
        // Fetch current state - we may have missed updates before listeners were ready
        fetchCurrentGameInfo();
      }
    });
  } catch (e) {
    gepRequestedOk = false;
    eventsOk = false;
    sendStatusToLauncher();
    diagInfo("setRequiredFeatures ERROR: " + (e && e.message ? e.message : String(e)) + " - retrying in " + (GEP_RETRY_MS / 1000) + "s");
    gepRetryTimer = setTimeout(function () {
      if (valorantRunning) setRequiredFeatures();
    }, GEP_RETRY_MS);
  }
}

function onEventsError(e) {
  eventsOk = false;
  gepRequestedOk = false;
  sendStatusToLauncher();

  var reason = (e && e.reason) ? e.reason : JSON.stringify(e);
  diagInfo("GEP error: " + reason + " - retrying in " + (GEP_RETRY_MS / 1000) + "s");

  // Re-register features after a GEP error
  gepRetryTimer = setTimeout(function () {
    if (valorantRunning) setRequiredFeatures();
  }, GEP_RETRY_MS);
}

// Try to infer team color
function inferTeam(meObj) {
  // Common keys: team / team_id / teamId
  try {
    if (meObj.team !== undefined && meObj.team !== null) return String(meObj.team).toLowerCase();
    if (meObj.team_id !== undefined && meObj.team_id !== null) return String(meObj.team_id).toLowerCase();
    if (meObj.teamId !== undefined && meObj.teamId !== null) return String(meObj.teamId).toLowerCase();
  } catch (e) {}
  return null;
}

// ---------------- Match info (round/phase + new match) ----------------
function handleMatchInfoUpdate(mi) {
  if (!mi || typeof mi !== "object") return;

  var matchId = null;
  if (mi.match_id !== undefined && mi.match_id !== null) matchId = String(mi.match_id);
  else if (mi.matchId !== undefined && mi.matchId !== null) matchId = String(mi.matchId);

  var mapId = null;
  if (mi.map_id !== undefined && mi.map_id !== null) mapId = String(mi.map_id);
  else if (mi.mapId !== undefined && mi.mapId !== null) mapId = String(mi.mapId);

  if (matchId && matchId !== lastMatchId) {
    lastMatchId = matchId;
    if (mapId) lastMapId = mapId;
    resetForNewMatch("match_id changed");
  } else if (!matchId && mapId && mapId !== lastMapId) {
    lastMapId = mapId;
    resetForNewMatch("map_id changed");
  }

  var roundNumberRaw = (mi.round_number !== undefined) ? mi.round_number : mi.roundNumber;
  var roundPhaseRaw = (mi.round_phase !== undefined) ? mi.round_phase : mi.roundPhase;

  var roundNumber = (roundNumberRaw !== undefined && roundNumberRaw !== null) ? Number(roundNumberRaw) : null;
  var roundPhase = roundPhaseRaw ? String(roundPhaseRaw).toLowerCase() : null;

  if (roundNumber !== null && isFinite(roundNumber)) lastKnownRound = roundNumber;
  if (roundPhase) lastKnownPhase = roundPhase;

  var effectiveRound = (roundNumber !== null && isFinite(roundNumber)) ? roundNumber : lastKnownRound;
  var effectivePhase = roundPhase || lastKnownPhase;

  // SCORE TRACKING
  // Parse score from match_info (format: {"won":9,"lost":2})
  if (mi.score !== undefined && mi.score !== null) {
    var scoreObj = parseMaybeJson(mi.score);
    if (scoreObj && typeof scoreObj === "object") {
      var newWon = Number(scoreObj.won);
      var newLost = Number(scoreObj.lost);
      
      if (isFinite(newWon) && isFinite(newLost)) {
        // Detect round result
        if (newWon > lastScoreWon) {
          // We won the last round
          currentStreak = (currentStreak >= 0) ? currentStreak + 1 : 1;
          if (settings.devMode) diagDebug("🎉 Round WON | Streak: " + currentStreak);
        } else if (newLost > lastScoreLost) {
          // We lost the last round
          currentStreak = (currentStreak <= 0) ? currentStreak - 1 : -1;
          if (settings.devMode) diagDebug("💀 Round LOST | Streak: " + currentStreak);

          // First round on defender side: round 1 or 13 depending on half — show "Try stacking a site." once per such round
          var lostRound = (effectiveRound !== null && isFinite(effectiveRound) && effectiveRound > 0) ? effectiveRound - 1 : null;
          if (lostRound === 1 || lostRound === 13) {
            var sideForLostRound = getSideForRound(lostRound);
            if (sideForLostRound === "def" && !stackedToastShownForRounds[lostRound]) {
              stackedToastShownForRounds[lostRound] = true;
              showToast("FOCUS", "Try stacking a site.", tuning().toastMs);
              markMessageShown("Try stacking a site.");
              recordSessionMessage("Try stacking a site.", "first_def_loss", lostRound);
              diagInfo("First def round loss toast ✅ (round " + lostRound + ")");
            }
          }
        }
        
        myScore.won = newWon;
        myScore.lost = newLost;
        lastScoreWon = newWon;
        lastScoreLost = newLost;
        
        // Track peak lead/deficit for comeback detection (both directions)
        var currentLead = newWon - newLost;
        if (currentLead > peakLead) peakLead = currentLead;
        var currentDeficit = newLost - newWon;
        if (currentDeficit > peakDeficit) peakDeficit = currentDeficit;
      }
    }
  }
  
  // Parse match_score for enemy score (format: {"team_0":0,"team_1":2})
  if (mi.match_score !== undefined && mi.match_score !== null) {
    var matchScoreObj = parseMaybeJson(mi.match_score);
    if (matchScoreObj && typeof matchScoreObj === "object") {
      var t0 = Number(matchScoreObj.team_0);
      var t1 = Number(matchScoreObj.team_1);
      if (isFinite(t0) && isFinite(t1)) {
        if (localTeamId === 0) {
          // We are team 0: enemy rounds = t1
          enemyScore.won = t1;
        } else if (localTeamId === 1) {
          // We are team 1: enemy rounds = t0
          enemyScore.won = t0;
        } else {
          // localTeamId not yet known: fall back to subtraction
          var totalRounds = myScore.won + myScore.lost;
          var theirRounds = t0 + t1 - totalRounds;
          if (theirRounds >= 0) enemyScore.won = theirRounds;
        }
      }
    }
  }

  // Side detection (Valorant)
  // Prefer match_info.team (attack/defense). Fallback: roster local teamId + halftime flip.
  var sideRaw = (mi.team !== undefined && mi.team !== null) ? mi.team : ((mi.side !== undefined && mi.side !== null) ? mi.side : null);
  var sideNorm = normalizeSide(sideRaw);
  if (sideNorm) {
    if (settings.devMode && matchTeamSide !== sideNorm) {
      diagDebug("Side detected from match_info.team: " + sideNorm);
    }
    matchTeamSide = sideNorm;
  } else if (settings.devMode && sideRaw) {
    diagDebug("Side detection failed: sideRaw=" + sideRaw + " (not normalized)");
  }

  if (mi.roster !== undefined && mi.roster !== null) {
    var tid = getLocalTeamIdFromRoster(mi.roster);
    if (tid !== null) {
      if (settings.devMode && localTeamId !== tid) {
        diagDebug("LocalTeamId detected from roster: " + tid);
      }
      localTeamId = tid;
    } else if (settings.devMode) {
      diagDebug("LocalTeamId detection failed: roster exists but no local player found");
    }

    // Agent fallback from roster character field (backup if me.agent hasn't fired yet)
    if (!localPlayerAgent) {
      var agentFromRoster = getLocalAgentFromRoster(mi.roster);
      if (agentFromRoster) {
        localPlayerAgent = agentFromRoster;
        diagDebug("Agent detected from roster: " + localPlayerAgent);
      }
    }

    if (!matchTeamSide && effectiveRound !== null) {
      var s3 = sideFromTeamIdAndRound(localTeamId, effectiveRound);
      if (s3) {
        if (settings.devMode) {
          diagDebug("Side inferred from localTeamId fallback: " + s3);
        }
        matchTeamSide = s3;
      }
    }
  }

  // New match safety: if round counter decreases
  if (lastRoundNumber !== null && effectiveRound !== null && effectiveRound < lastRoundNumber) {
    resetForNewMatch("round counter decreased");
  }

  if (lastRoundNumber === null && effectiveRound !== null) {
    lastRoundNumber = effectiveRound;
    diagDebug("VALO init: round=" + effectiveRound + " phase=" + (effectivePhase || "?"));
    // Start agent poll if we still don't know the agent at match start
    if (!localPlayerAgent) startAgentPoll();
  }

  // Round changed
  if (effectiveRound !== null && lastRoundNumber !== null && effectiveRound !== lastRoundNumber) {
    lastRoundNumber = effectiveRound;
    diagDebug("Round changed -> " + effectiveRound);
  }

  // Buy phase detection
  var phase = effectivePhase;
  var isBuy =
    (phase === "shopping" || phase === "buy" || phase === "pre_round" || phase === "buy_phase" ||
     phase === "shopping_phase" || phase === "shoppingphase");

  // Show exactly ONE toast per round (buy phase gate)
  if (effectiveRound !== null && isBuy) {
    // Round 1 is always silent (no toast).
    if (effectiveRound === 1) {
      if (lastToastRoundNumber !== 1) {
        lastToastRoundNumber = 1;
        diagInfo("Round 1 silent ✅");
      }
    } else {
      if (lastToastRoundNumber !== effectiveRound) {
        lastToastRoundNumber = effectiveRound;

        // HALFTIME: Round 13 gets a special one-time message before normal logic
        if (effectiveRound === 13 && !halftimeShownForMatch) {
          halftimeShownForMatch = true;
          var htMsg = pickRandomMessage(TOASTS_HALFTIME, 0);
          showToast("FOCUS", htMsg, tuning().toastMs);
          markMessageShown(htMsg);
          recordSessionMessage(htMsg, "halftime", effectiveRound);
          diagInfo("Halftime toast shown ✅ (round 13)");
        } else {
          var chosen = chooseRoundToast(effectiveRound);
          if (chosen && chosen.msg) {
            showToast("FOCUS", chosen.msg, tuning().toastMs);
            markMessageShown(chosen.msg);
            recordSessionMessage(chosen.msg, chosen.category, effectiveRound);
            var sideDetected = getSideForRound(effectiveRound);
            diagInfo("Round toast shown ✅ (round " + effectiveRound + " | side=" + sideDetected +
              " | matchTeamSide=" + (matchTeamSide || "?") +
              " | localTeamId=" + (localTeamId === null ? "?" : localTeamId) + ")");
          } else {
            diagDebug("Round toast missing (no message chosen) (round " + effectiveRound + ")");
          }
        }
      }
    }
  }

  // End
  if (phase === "game_end") {
    resetForNewMatch("game_end");
  }
}

// ---------------- Agent resolution ----------------
function resolveAgentFromInternalId(id) {
  var map = {
    "Clay_PC_C": "Raze",      "Pandemic_PC_C": "Viper",    "Wraith_PC_C": "Omen",
    "Hunter_PC_C": "Sova",    "Thorne_PC_C": "Sage",       "Phoenix_PC_C": "Phoenix",
    "Wushu_PC_C": "Jett",     "Gumshoe_PC_C": "Cypher",    "Sarge_PC_C": "Brimstone",
    "Breach_PC_C": "Breach",  "Vampire_PC_C": "Reyna",     "Killjoy_PC_C": "Killjoy",
    "Guide_PC_C": "Skye",     "Stealth_PC_C": "Yoru",      "Rift_PC_C": "Astra",
    "Grenadier_PC_C": "KAYO", "Deadeye_PC_C": "Chamber",   "Sprinter_PC_C": "Neon",
    "BountyHunter_PC_C": "Fade", "Mage_PC_C": "Harbor",   "AggroBot_PC_C": "Gekko",
    "Cable_PC_C": "Deadlock", "Sequoia_PC_C": "Iso",       "Smonk_PC_C": "Clove",
    "Nox_PC_C": "Vyse",       "Cashew_PC_C": "Tejo",       "Terra_PC_C": "Waylay"
    // Veto: internal ID unknown — add entry here once discovered (e.g. "Veto_PC_C": "Veto")
  };
  return map[id] || null;
}

// Roster character field is the internal ID prefix (e.g. "Wushu" → "Wushu_PC_C")
function resolveAgentFromCharacterField(character) {
  if (!character) return null;
  return resolveAgentFromInternalId(character + "_PC_C");
}

function getLocalAgentFromRoster(roster) {
  if (!roster) return null;
  var arr = Array.isArray(roster) ? roster : Object.values(roster);
  for (var i = 0; i < arr.length; i++) {
    var p = arr[i];
    if (!p || typeof p !== "object") continue;
    var isLocal = (p.is_local === true) || (p.local === true) ||
                  (String(p.is_local).toLowerCase() === "true") ||
                  (String(p.local).toLowerCase() === "true");
    if (!isLocal) continue;
    if (p.character && typeof p.character === "string") {
      return resolveAgentFromCharacterField(p.character);
    }
  }
  return null;
}

// ---------------- Side logic ----------------
// Side detection priority:
// 1) match_info.team (attack/defense)  -> matchTeamSide
// 2) roster local player's teamId (0/1) + round_number halftime flip
// 3) legacy meTeam "blue/red" inference
//
// NOTE: Overwolf Valorant GEP exposes match_info.team as attack/defense when available.
function normalizeSide(v) {
  if (v === undefined || v === null) return null;
  var s = String(v).toLowerCase();
  if (s.indexOf("attack") >= 0) return "atk";
  if (s.indexOf("def") >= 0) return "def";
  return null;
}

function getLocalTeamIdFromRoster(roster) {
  if (!roster) return null;
  var arr = Array.isArray(roster) ? roster : Object.values(roster);
  for (var i = 0; i < arr.length; i++) {
    var p = arr[i];
    if (!p || typeof p !== "object") continue;
    var isLocal = (p.is_local === true) || (String(p.is_local).toLowerCase() === "true");
    if (!isLocal) continue;
    var tid = p.team;
    if (tid === 0 || tid === 1) return tid;
    var n = Number(tid);
    if (n === 0 || n === 1) return n;
  }
  return null;
}

function sideFromTeamIdAndRound(teamId, roundNumber) {
  if (!(teamId === 0 || teamId === 1)) return null;
  var r = Number(roundNumber);
  if (!isFinite(r) || r <= 0) return null;

  // Valorant round structure:
  // Rounds  1-12: first half  (team 0 = atk, team 1 = def)
  // Rounds 13-24: second half (sides flip)
  // Rounds 25+:   overtime    (sides swap every 2 rounds)
  //   25-26: same as round 24 (team 0 = def, team 1 = atk) wait...
  //   Actually overtime: each OT pair starts fresh. Round 25-26 = pair 1.
  //   Odd OT pair (25-26, 29-30...): team 0 = atk, team 1 = def  (back to start)
  //   Even OT pair (27-28, 31-32...): team 0 = def, team 1 = atk
  if (r <= 12) {
    return (teamId === 0) ? "atk" : "def";
  }
  if (r <= 24) {
    return (teamId === 0) ? "def" : "atk";
  }
  // Overtime: pairs of 2 starting at round 25
  // OT pair index (0-based): Math.floor((r - 25) / 2)
  var otPairIndex = Math.floor((r - 25) / 2);
  var otFlipped = (otPairIndex % 2 === 1);
  if (!otFlipped) {
    return (teamId === 0) ? "atk" : "def";
  }
  return (teamId === 0) ? "def" : "atk";
}

// Valorant: "blue" is defenders for first half; after half swap.
// Round 1-12 = first half. Round 13+ = second half.
// If we cannot infer team, fallback to "unknown" -> use attacker pool as default.
function normalizeTeamColor(t) {
  if (!t) return null;
  var s = String(t).toLowerCase();
  if (s.indexOf("blue") >= 0) return "blue";
  if (s.indexOf("red") >= 0) return "red";
  return s;
}

function getSideForRound(roundNumber) {
  // 1) Prefer match_info.team-derived side
  if (matchTeamSide === "atk" || matchTeamSide === "def") return matchTeamSide;

  // 2) Fallback: roster local teamId + halftime flip
  var s2 = sideFromTeamIdAndRound(localTeamId, roundNumber);
  if (s2) return s2;

  // 3) Legacy fallback: blue/red inference
  var team = normalizeTeamColor(meTeam);
  if (!team || (team !== "blue" && team !== "red")) return "unknown";

  var r = Number(roundNumber);
  if (!isFinite(r) || r <= 0) r = 1;

  var firstHalf = (r <= 12);

  // In Valorant: First half: Blue=Def, Red=Atk
  // Second half: Blue=Atk, Red=Def
  if (firstHalf) {
    return (team === "blue") ? "def" : "atk";
  } else {
    return (team === "blue") ? "atk" : "def";
  }
}

// ---------------- Toast choice logic (always returns {msg, category}) ----------------
function chooseRoundToast(roundNumber) {
  var t = tuning();
  var r = Number(roundNumber);
  var cd = t.perMessageCooldownMs;

  // Category cooldown: same category won't repeat within ~20s
  var CAT_CD = 20000;

  // OVERTIME (rounds 25+): announce each new OT pair once
  if (r >= 25) {
    var otPair = Math.floor((r - 25) / 2);
    if (overtimeAnnouncedRound !== otPair) {
      overtimeAnnouncedRound = otPair;
      var otMsg = pickRandomMessage(TOASTS_OVERTIME, cd);
      markCategoryShown("overtime");
      return { msg: otMsg, category: "overtime" };
    }
  }

  // MATCH POINT (round 24)
  if (r === 24) {
    var mpMsg = pickFromCategory(TOASTS_MATCH_POINT, "match_point", CAT_CD, cd);
    if (mpMsg) { markCategoryShown("match_point"); return { msg: mpMsg, category: "match_point" }; }
  }

  // ULT AWARENESS (rounds 4+, 15% chance, category cooldown prevents back-to-back)
  if (r >= 4) {
    if (Math.random() < 0.15) {
      var awaMsg = pickFromCategory(TOASTS_ULT_AWARENESS, "ult_awareness", CAT_CD, cd);
      if (awaMsg) { markCategoryShown("ult_awareness"); return { msg: awaMsg, category: "ult_awareness" }; }
    }
  }

  // BONUS ROUND (round 3 or 15, won pistol R1 + eco R2 = now on bonus)
  var isBonusRound = (r === 3 || r === 15) && currentStreak >= 2;
  if (isBonusRound) {
    var bonusMsg = pickFromCategory(TOASTS_BONUS_ROUND, "bonus_round", CAT_CD, cd);
    if (bonusMsg) { markCategoryShown("bonus_round"); return { msg: bonusMsg, category: "bonus_round" }; }
  }

  // SCORE-BASED COACHING (check after special rounds, before side-specific)
  var roundDiff = myScore.won - myScore.lost;
  var totalRounds = myScore.won + myScore.lost;

  // CLOSE GAME (11-11 or 12-12)
  if ((myScore.won === 11 && myScore.lost === 11) || (myScore.won === 12 && myScore.lost === 12)) {
    var closeMsg = pickFromCategory(TOASTS_CLOSE_GAME, "close_game", CAT_CD, cd);
    if (closeMsg) { markCategoryShown("close_game"); return { msg: closeMsg, category: "close_game" }; }
  }

  // GETTING COMEBACK'D ON (had big lead, now losing it)
  if (peakLead >= 5 && roundDiff <= 2 && currentStreak <= -3) {
    var cbdMsg = pickFromCategory(TOASTS_COMEBACKD, "comebackd", CAT_CD, cd);
    if (cbdMsg) { markCategoryShown("comebackd"); return { msg: cbdMsg, category: "comebackd" }; }
  }

  // OPPONENT COMEBACK (they closed a 4+ round gap recently)
  if (peakLead >= 4 && roundDiff <= 2 && currentStreak <= -2 && totalRounds >= 8) {
    var comebackMsg = pickFromCategory(TOASTS_COMEBACK, "comeback", CAT_CD, cd);
    if (comebackMsg) { markCategoryShown("comeback"); return { msg: comebackMsg, category: "comeback" }; }
  }

  // WIN STREAK (3+ wins in a row)
  if (currentStreak >= 3 && r >= 4) {
    if (Math.random() < 0.60) {
      var winStreakMsg = pickFromCategory(TOASTS_WIN_STREAK, "win_streak", CAT_CD, cd);
      if (winStreakMsg) { markCategoryShown("win_streak"); return { msg: winStreakMsg, category: "win_streak" }; }
    }
  }

  // LOSS STREAK (3+ losses in a row)
  if (currentStreak <= -3 && r >= 4) {
    if (Math.random() < 0.70) {
      var lossStreakMsg = pickFromCategory(TOASTS_LOSS_STREAK, "loss_streak", CAT_CD, cd);
      if (lossStreakMsg) { markCategoryShown("loss_streak"); return { msg: lossStreakMsg, category: "loss_streak" }; }
    }
  }

  // BIG LEAD (5+ round advantage)
  if (roundDiff >= 5 && totalRounds >= 7) {
    if (Math.random() < 0.40) {
      var leadMsg = pickFromCategory(TOASTS_BIG_LEAD, "big_lead", CAT_CD, cd);
      if (leadMsg) { markCategoryShown("big_lead"); return { msg: leadMsg, category: "big_lead" }; }
    }
  }

  // AGENT-SPECIFIC or GENERIC SIDE (50/50 when agent is known — gives equal variety)
  if (localPlayerAgent && Math.random() < 0.5) {
    var agentPools = AGENT_POOLS[localPlayerAgent];
    if (agentPools) {
      var agentSide = getSideForRound(r);
      var agentPool = (agentSide === "def") ? agentPools.def : agentPools.atk;
      var agentCatKey = "agent_" + localPlayerAgent.toLowerCase() + "_" + (agentSide === "def" ? "def" : "atk");
      var agentMsg = pickFromCategory(agentPool, agentCatKey, CAT_CD, cd);
      if (agentMsg) { markCategoryShown(agentCatKey); return { msg: agentMsg, category: "agent_" + localPlayerAgent.toLowerCase() }; }
    }
  }

  // SIDE-SPECIFIC (core fallback — used when agent unknown or has no tip pool)
  var side = getSideForRound(r);
  if (settings.devMode && side === "unknown") {
    diagDebug("⚠️ SIDE UNKNOWN on round " + r + " (matchTeamSide=" + (matchTeamSide || "?") + ", localTeamId=" + (localTeamId === null ? "?" : localTeamId) + ", meTeam=" + (meTeam || "?") + ")");
  }
  if (side === "atk") {
    var atkMsg = pickFromCategory(TOASTS_ATTACKER, "atk", CAT_CD, cd);
    if (atkMsg) { markCategoryShown("atk"); return { msg: atkMsg, category: "attack" }; }
  } else if (side === "def") {
    var defMsg = pickFromCategory(TOASTS_DEFENDER, "def", CAT_CD, cd);
    if (defMsg) { markCategoryShown("def"); return { msg: defMsg, category: "defense" }; }
  }

  // FINAL FALLBACK (side unknown or all categories on cooldown)
  var fallbackMsg = pickRandomMessage(TOASTS_ATTACKER, cd);
  markCategoryShown("atk");
  return { msg: fallbackMsg, category: "attack" };
}

// ---------------- ME inference (team + agent) ----------------
function handleMeInference(meObj) {
  if (!meObj || typeof meObj !== "object") return;

  var team = inferTeam(meObj);
  if (team) meTeam = team;

  // Agent detection from me.agent (internal ID like "Wushu_PC_C")
  if (meObj.agent && typeof meObj.agent === "string" && !localPlayerAgent) {
    var resolved = resolveAgentFromInternalId(meObj.agent);
    if (resolved) {
      localPlayerAgent = resolved;
      diagDebug("Agent detected from me.agent: " + localPlayerAgent + " (" + meObj.agent + ")");
    }
  }
}

// ---------------- GEP listener ----------------
function onInfoUpdates2(e) {
  if (!e || !e.info) return;

  gepSeenAnyUpdate = true;
  lastGepUpdateAt = nowMs();

  if (valorantRunning && !eventsOk) {
    eventsOk = true;
    sendStatusToLauncher();
    diagInfo("GEP OK ✅ receiving data");
  }

  var info = e.info;

  if (info.me) {
    var meObj = parseMaybeJson(info.me);
    if (meObj) handleMeInference(meObj);
  }

  if (info.match_info) {
    var matchInfo = parseMaybeJson(info.match_info);
    if (matchInfo) handleMatchInfoUpdate(matchInfo);
  }

  sendStatusToLauncher();
}

function fetchCurrentGameInfo() {
  try {
    overwolf.games.events.getInfo(function (res) {
      if (!res || !res.success || !res.res) return;
      // GetInfoResult.res has features (me, match_info, game_info) - same shape as onInfoUpdates2 e.info
      var info = res.res;
      if (Object.keys(info || {}).length === 0) return;
      onInfoUpdates2({ info: info });
    });
  } catch (e) {
    diagDebug("getInfo ERROR: " + (e && e.message ? e.message : String(e)));
  }
}

// Agent detection retry — polls GEP every 5s while agent is unknown, gives up after 12 tries (~60s)
var AGENT_POLL_INTERVAL_MS = 5000;
var AGENT_POLL_MAX_TRIES = 12;

function startAgentPoll() {
  stopAgentPoll();  // clear any existing timer first
  if (localPlayerAgent) return;  // already known, nothing to do
  var tries = 0;
  diagDebug("Agent poll started (max " + AGENT_POLL_MAX_TRIES + " tries every " + (AGENT_POLL_INTERVAL_MS / 1000) + "s)");
  agentPollTimer = setInterval(function () {
    if (localPlayerAgent) {
      diagDebug("Agent poll resolved: " + localPlayerAgent + " — stopping poll");
      stopAgentPoll();
      return;
    }
    tries++;
    diagDebug("Agent poll try " + tries + "/" + AGENT_POLL_MAX_TRIES + " (agent still unknown)");
    fetchCurrentGameInfo();
    if (tries >= AGENT_POLL_MAX_TRIES) {
      diagDebug("Agent poll giving up after " + tries + " tries — agent not detected");
      stopAgentPoll();
    }
  }, AGENT_POLL_INTERVAL_MS);
}

function stopAgentPoll() {
  if (agentPollTimer) {
    clearInterval(agentPollTimer);
    agentPollTimer = null;
  }
}

function attachEventListeners() {
  try { overwolf.games.events.onInfoUpdates2.removeListener(onInfoUpdates2); } catch (e) {}
  try { overwolf.games.events.onError.removeListener(onEventsError); } catch (e) {}

  try { overwolf.games.events.onInfoUpdates2.addListener(onInfoUpdates2); } catch (e) {}
  try { overwolf.games.events.onError.addListener(onEventsError); } catch (e) {}
}

// ---------------- Windows init ----------------
function obtainDeclared(name, cb) {
  overwolf.windows.obtainDeclaredWindow(name, function (res) {
    if (res && res.success && res.window) cb(res.window);
    else cb(null);
  });
}

var launcherShownOnce = false;

function showLauncherWindowOnce() {
  if (!launcherId) return;
  if (launcherShownOnce) return;
  launcherShownOnce = true;

  try {
    overwolf.windows.restore(launcherId, function () {
      try { overwolf.windows.bringToFront(launcherId, function () {}); } catch (e) {}
    });
  } catch (e) {}
}

function ensureWindows() {
  obtainDeclared(LAUNCHER_WINDOW, function (lw) {
    if (lw && lw.id) launcherId = lw.id;

    obtainDeclared(INGAME_WINDOW, function (ig) {
      if (ig && ig.id) {
        inGameId = ig.id;
        try { overwolf.windows.hide(inGameId, function () {}); } catch (e) {}
      }

      diagInfo("BOOT OK ✅ (background alive)");

      showLauncherWindowOnce();
      setTimeout(function () { showLauncherWindowOnce(); }, 400);

      pushSettingsToLauncher();
      sendStatusToLauncher();
    });
  });
}

// ---------------- Message bus (KEEP IDs) ----------------
overwolf.windows.onMessageReceived.addListener(function (e) {
  if (!e || !e.id) return;

  var senderId = getSenderWindowId(e);
  if (!launcherId && senderId) launcherId = senderId;

  if (e.id === "status_get" || e.id === "request_status") {
    sendStatusToLauncher(senderId, true);
    return;
  }

  if (e.id === "settings_get" || e.id === "request_settings") {
    pushSettingsToLauncher(senderId);
    return;
  }

  if (e.id === "settings_update") {
    var s = e.content || {};

    if (typeof s.overlayEnabled === "boolean") settings.overlayEnabled = s.overlayEnabled;
    if (s.position) settings.position = s.position;
    if (s.intensity) settings.intensity = s.intensity;
    if (typeof s.devMode === "boolean") settings.devMode = s.devMode;
    saveSettings();
    pushSettingsToLauncher(senderId);

    diagDebug("Settings updated: " + JSON.stringify(settings), senderId);
    return;
  }

  if (e.id === "preview_toast") {
    var previewMessages = [
      "Stay disciplined. Play your role.",
      "Information before commitment.",
      "Play off your teammates.",
      "Time is on your side. Use it.",
      "Your ult is ready. Make it count."
    ];
    var previewMsg = previewMessages[Math.floor(Math.random() * previewMessages.length)];
    showToast("FOCUS", previewMsg, tuning().toastMs);
    diagDebug("Preview toast fired: " + previewMsg, senderId);
    return;
  }

  if (e.id === "rate_message") {
    var rm = e.content || {};
    if (rm.messageText && (rm.vote === 1 || rm.vote === -1)) {
      saveRatingLocal(rm.messageText, rm.vote);
    }
    return;
  }
});


// ---------------- Session message persistence ----------------
function saveSessionMessages() {
  if (sessionMessages.length === 0) return;
  try {
    // Merge with any existing messages (from previous sessions)
    var existing = [];
    try {
      var raw = localStorage.getItem(UNRATED_KEY);
      if (raw) existing = JSON.parse(raw) || [];
    } catch (e) {}
    var merged = existing.concat(sessionMessages);
    // Cap history at 50 most recent messages
    if (merged.length > 50) merged = merged.slice(merged.length - 50);
    localStorage.setItem(UNRATED_KEY, JSON.stringify(merged));
    diagInfo("Session messages saved for rating (" + sessionMessages.length + " new, " + merged.length + " total)");
    sessionMessages = [];
    // Notify launcher so Rate Messages panel refreshes immediately
    sendToLauncher(null, "messages_saved", { count: merged.length });
  } catch (e) {}
}

// ---------------- Hard error logging ----------------
window.onerror = function (message, source, lineno, colno, error) {
  var msg =
    "JS ERROR: " + String(message) +
    " @ " + String(source || "?") + ":" + String(lineno || "?") + ":" + String(colno || "?") +
    (error && error.stack ? "\n" + error.stack : "");
  diagInfo(msg);
  return false;
};

// ---------------- Start ----------------
(function main() {
  ensureWindows();
  attachEventListeners();
  setRequiredFeatures();

  setInterval(pollGameStatus, STATUS_POLL_MS);
  pollGameStatus();
})();
