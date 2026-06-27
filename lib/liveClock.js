/** Modelo de minutero: 1T (1–45, 45+N), entretiempo, 2T (46–90, 90+N). */
const FH_REG = 45;
const FH_STOPPAGE = 6;
const HT_BREAK = 15;
const SH_REG = 45;
const SH_STOPPAGE = 8;

export const LIVE_MATCH_WINDOW_MS = (FH_REG + FH_STOPPAGE + HT_BREAK + SH_REG + SH_STOPPAGE + 5) * 60 * 1000;

export function computeLiveClock(kickoffUtc, now = Date.now()) {
  const elapsed = Math.max(0, Math.floor((now - new Date(kickoffUtc).getTime()) / 60000));
  const htWhistle = FH_REG + FH_STOPPAGE;
  const shKickoff = htWhistle + HT_BREAK;
  const shEndReg = shKickoff + SH_REG;
  const shWhistle = shEndReg + SH_STOPPAGE;

  const base = {
    elapsed,
    isHalftime: false,
    isFirstHalf: false,
    atOrAfterHT: false,
    finished: false,
  };

  if (elapsed >= shWhistle) {
    return {
      ...base,
      phase: 'ended',
      display: `90+${SH_STOPPAGE}'`,
      minute: 90 + SH_STOPPAGE,
      atOrAfterHT: true,
      finished: true,
    };
  }

  if (elapsed >= shEndReg) {
    const added = elapsed - shEndReg + 1;
    return {
      ...base,
      phase: '2h_stoppage',
      display: `90+${added}'`,
      minute: 90 + added,
      atOrAfterHT: true,
    };
  }

  if (elapsed >= shKickoff) {
    const shMin = 46 + (elapsed - shKickoff);
    return {
      ...base,
      phase: '2h',
      display: `${shMin}'`,
      minute: shMin,
      atOrAfterHT: true,
    };
  }

  if (elapsed >= htWhistle) {
    return {
      ...base,
      phase: 'halftime',
      display: 'ENTRETIEMPO',
      minute: 45,
      isHalftime: true,
      atOrAfterHT: true,
    };
  }

  if (elapsed >= FH_REG) {
    const added = elapsed - FH_REG + 1;
    return {
      ...base,
      phase: '1h_stoppage',
      display: `45+${added}'`,
      minute: FH_REG + added,
      isFirstHalf: true,
    };
  }

  const regMin = Math.max(1, elapsed + 1);
  return {
    ...base,
    phase: '1h',
    display: `${regMin}'`,
    minute: regMin,
    isFirstHalf: true,
  };
}

export function liveEvalContext(clock) {
  return {
    minute: clock.minute,
    display: clock.display,
    atOrAfterHT: clock.atOrAfterHT,
    isFirstHalf: clock.isFirstHalf,
    isHalftime: clock.isHalftime,
    finished: clock.finished,
  };
}
