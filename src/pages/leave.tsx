import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/*
  /leave-game — Mini Game: "ลาออกดีไหม?"
  Tech: Next.js (Pages Router) + TailwindCSS + framer-motion

  Updates in this version:
  - "ลาออกในอีก 1 ปีข้างหน้า" → ขยับทีละ 1 ปี (เดิม 1 เดือน)
  - ปรับ rate ขึ้นเงินเดือนให้ "น้อยลง": สุ่ม +0.5% ถึง +4% ต่อปี
  - ปรับข้อความ/Progress bar เป็นหน่วย "ปี"

  Win: แตะครบ 1 ปี → resign_after_year
  Lose: โดน layoff เมื่อกดปุ่มเลื่อนปี
*/

type Phase = "setup" | "playing" | "ended";
type EndType = "resign_now" | "resign_after_year" | "layoff" | null;

const pretty = (n: number) => new Intl.NumberFormat("th-TH").format(n);

export default function LeaveGamePage() {
    const [phase, setPhase] = useState<Phase>("setup");
    const [playerName, setPlayerName] = useState("");
    const [company, setCompany] = useState("");
    const [startSalary, setStartSalary] = useState<number | "">("");

    // Game state
    const [years, setYears] = useState(0); // 0..1 (ขยับทีละ 1 ปี)
    const [salary, setSalary] = useState(0);
    const [luckSeed, setLuckSeed] = useState(Math.random());
    const [resignNowScale, setResignNowScale] = useState(1);
    const [resignNowVisible, setResignNowVisible] = useState(true);
    const [offerPct, setOfferPct] = useState<number | null>(null); // e.g., 0.25 ⇒ +25%
    const [endType, setEndType] = useState<EndType>(null);
    const TARGET_YEARS = 10
    const yearsLeft = Math.max(0, TARGET_YEARS - years);
    const progress = years / TARGET_YEARS;

    // Simple dynamic background gradient hue by progress
    const hue = useMemo(() => Math.floor(200 - progress * 180), [progress]);

    const reset = () => {
        setPhase("setup");
        setPlayerName("");
        setCompany("");
        setStartSalary("");
        setYears(0);
        setSalary(0);
        setLuckSeed(Math.random());
        setResignNowScale(1);
        setResignNowVisible(true);
        setOfferPct(null);
        setEndType(null);
    };

    const start = () => {
        if (!playerName.trim() || !company.trim() || !startSalary || startSalary <= 0) return;
        setSalary(Number(startSalary));
        setPhase("playing");
    };

    // Core random helpers
    const rand = () => {
        // Slightly deterministic per round using seed (ใช้ years เป็นตัวแปรรอบ)
        const x = Math.sin((years + 1) * 9973 * (luckSeed + 0.12345)) * 10000;
        return x - Math.floor(x);
    };

    const randomBetween = (min: number, max: number) => min + rand() * (max - min);

    const rollEvent = () => {
        // 10% Layoff chance per click
        const layoff = rand() < 0.1;
        if (layoff) {
            setEndType("layoff");
            setPhase("ended");
            return true;
        }
        return false;
    };

    const shrinkResignNow = () => {
        // Shrink by 5% to 20% randomly; sometimes poof (disappear)
        const shrinkBy = randomBetween(0.05, 0.2);
        const newScale = Math.max(0, resignNowScale * (1 - shrinkBy));
        setResignNowScale(newScale);
        if (rand() < 0.12 && newScale < 0.3) {
            // 12% chance to vanish once small enough
            setResignNowVisible(false);
        }
    };

    const maybeSpecialOffer = () => {
        // 20% chance to show a limited-time offer between 10% and 40%
        if (rand() < 0.2) {
            const pct = Number(randomBetween(0.1, 0.4).toFixed(2));
            setOfferPct(pct);
        } else {
            setOfferPct(null);
        }
    };

    const clickResignLater = () => {
        if (phase !== "playing") return;

        // Advance 1 year
        const nextYears = Math.min(TARGET_YEARS, years + 1);

        // Salary up 0.5% – 4% randomly (ต่อปี)
        const up = Number(randomBetween(0.005, 0.04).toFixed(4));
        const nextSalary = Math.round(salary * (1 + up));

        // Events: Layoff? Shrink Now button; Maybe special offer
        const didEnd = rollEvent();
        if (didEnd) return;

        shrinkResignNow();
        maybeSpecialOffer();

        setYears(nextYears);
        setSalary(nextSalary);

        if (nextYears >= TARGET_YEARS) {
            setEndType("resign_after_year");
            setPhase("ended");
        }
    };

    const clickResignNow = () => {
        if (phase !== "playing") return;
        const finalSalary = offerPct ? Math.round(salary * (1 + offerPct)) : salary;
        setSalary(finalSalary);
        setEndType("resign_now");
        setPhase("ended");
    };

    const headline = useMemo(() => {
        if (phase === "setup") return "ลาออกดีไหม? mini-game";
        if (phase === "playing") return `บริษัท ${company} · เงินเดือนปัจจุบัน ${pretty(salary)} บาท`;
        if (endType === "layoff") return "Game Over — โดนเลย์ออฟ";
        if (endType === "resign_after_year") return `ยื่นลาออกหลังครบ ${TARGET_YEARS} ปีสำเร็จ!`;
        if (endType === "resign_now") return "ตัดสินใจลาออกตอนนี้!";
        return "จบเกม";
    }, [phase, endType, company, salary]);

    return (
        <div
            className="min-h-screen w-full"
            style={{
                background: `radial-gradient(1200px 600px at 20% -10%, hsl(${hue} 90% 92%), transparent 60%),
                     linear-gradient(135deg, hsl(${hue} 70% 18%) 0%, hsl(${hue} 70% 8%) 100%)`,
            }}
        >
            <div className="max-w-3xl mx-auto px-4 py-10">
                <motion.h1
                    className="text-3xl md:text-4xl font-bold text-white/90 drop-shadow-sm"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    {headline}
                </motion.h1>

                {/* Card */}
                <motion.div
                    className="mt-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 shadow-2xl"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                >
                    <div className="p-5 md:p-8">
                        {/* Setup Phase */}
                        {phase === "setup" && (
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-white/80 mb-1">ชื่อคุณ</label>
                                    <input
                                        className="w-full rounded-xl bg-white/80 px-4 py-3 outline-none focus:bg-white shadow"
                                        placeholder="เช่น Tar"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-white/80 mb-1">ชื่อบริษัท</label>
                                    <input
                                        className="w-full rounded-xl bg-white/80 px-4 py-3 outline-none focus:bg-white shadow"
                                        placeholder="เช่น Prior / Any Co., Ltd."
                                        value={company}
                                        onChange={(e) => setCompany(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-white/80 mb-1">เงินเดือนปัจจุบัน (บาท)</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-xl bg-white/80 px-4 py-3 outline-none focus:bg-white shadow"
                                        placeholder="เช่น 45000"
                                        value={startSalary}
                                        onChange={(e) => setStartSalary(e.target.value ? Number(e.target.value) : "")}
                                    />
                                </div>
                                <motion.button
                                    onClick={start}
                                    className="mt-2 inline-flex items-center justify-center rounded-xl px-5 py-3 font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg active:scale-[0.98]"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    เริ่มเกม
                                </motion.button>
                            </div>
                        )}

                        {/* Playing Phase */}
                        {phase === "playing" && (
                            <div className="space-y-6">
                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
                                    <Stat label="ผู้เล่น" value={playerName || "–"} />
                                    <Stat label="บริษัท" value={company || "–"} />
                                    <Stat label="เงินเดือน" value={`${pretty(salary)} บาท`} />
                                    <Stat label="เหลืออีก" value={`${yearsLeft} ปี`} />
                                </div>

                                {/* Progress Bar (0 → 1 ปี) */}
                                <div>
                                    <div className="flex items-center justify-between text-white/80 text-xs mb-1">
                                        <span>0 ปี</span>
                                        <span>10 ปี</span>
                                    </div>
                                    <div className="h-3 rounded-full bg-black/20 overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress * 100}%` }}
                                            transition={{ type: "spring", stiffness: 120, damping: 20 }}
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap items-start gap-4">
                                    {/* Resign Later Button */}
                                    <motion.button
                                        onClick={clickResignLater}
                                        className="relative inline-flex items-center justify-center rounded-2xl px-6 py-4 font-semibold text-slate-900 bg-white shadow-xl border border-black/10 hover:-translate-y-0.5 active:translate-y-0 transition-transform"
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <span className="text-base">ลาออกในอีก 1 ปีข้างหน้า</span>
                                        <span className="ml-2 text-xs text-slate-500">
                      (+สุ่มขึ้นเงินเดือนเล็กน้อย, เสี่ยงโดนเลย์ออฟ)
                    </span>
                                        <GlitchLine />
                                    </motion.button>

                                    {/* Resign Now Button (shrinking) */}
                                    <AnimatePresence>
                                        {resignNowVisible && (
                                            <motion.button
                                                key="resignNow"
                                                onClick={clickResignNow}
                                                className="relative inline-flex items-center justify-center rounded-2xl px-6 py-4 font-semibold text-white shadow-xl"
                                                style={{ background: "linear-gradient(135deg,#f97316,#ef4444)", transformOrigin: "center" }}
                                                animate={{ scale: resignNowScale }}
                                                whileHover={{ scale: resignNowScale * 1.04 }}
                                                whileTap={{ scale: resignNowScale * 0.97 }}
                                                exit={{ opacity: 0, scale: 0.6, y: -6 }}
                                            >
                                                <span className="text-base">ลาออกตอนนี้</span>
                                                {offerPct !== null && (
                                                    <span className="ml-2 text-xs bg-white/15 px-2 py-1 rounded-full">
                            ข้อเสนอพิเศษ +{Math.round(offerPct * 100)}%
                          </span>
                                                )}
                                                <Shine />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Tips */}
                                <ul className="text-white/70 text-xs list-disc pl-5 space-y-1">
                                    <li>กด “ลาออกในอีก 1 ปีข้างหน้า” = เดินเวลา 1 ปี และสุ่มขึ้นเงินเดือนเล็กน้อย (0.5%–4%)</li>
                                    <li>มีโอกาสโดนเลย์ออฟทุกครั้งที่กด (Game Over)</li>
                                    <li>ปุ่ม “ลาออกตอนนี้” จะเล็กลงเรื่อย ๆ และอาจหายไป บางครั้งมีข้อเสนอพิเศษ</li>
                                </ul>
                            </div>
                        )}

                        {/* End Phase */}
                        {phase === "ended" && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                    <Stat label="ผู้เล่น" value={playerName} />
                                    <Stat label="บริษัท" value={company} />
                                    <Stat label="เงินเดือนสุดท้าย" value={`${pretty(salary)} บาท`} />
                                </div>

                                <div className="rounded-xl bg-white/70 p-4 text-slate-800 shadow flex items-center justify-between">
                                    <div>
                                        {endType === "layoff" && (
                                            <p className="font-semibold">`คุณโดนเลย์ออฟก่อนครบ 10 ปี — เกมจบ`</p>
                                        )}
                                        {endType === "resign_after_year" && (
                                            <p className="font-semibold">คุณอดทนครบ 1 ปีและยื่นลาออกอย่างสวยงาม 🎉</p>
                                        )}
                                        {endType === "resign_now" && (
                                            <p className="font-semibold">คุณตัดสินใจลาออกเดี๋ยวนั้น ✨</p>
                                        )}
                                        <p className="text-sm opacity-80">
                                            เริ่มที่ {startSalary ? pretty(Number(startSalary)) : "–"} บาท → จบที่ {pretty(salary)} บาท
                                        </p>
                                    </div>
                                    <motion.button
                                        onClick={reset}
                                        className="rounded-lg px-4 py-2 bg-slate-900 text-white shadow"
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        เล่นใหม่
                                    </motion.button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Footer */}
                <div className="mt-6 text-center text-white/60 text-xs">
                    <p>Mini-game for fun • ใช้ตัดสินใจจริงจังควรคิดให้รอบคอบ 😉</p>
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-xl bg-white/15 border border-white/10 px-3 py-3 text-white/90">
            <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
            <div className="text-sm font-semibold">{value}</div>
        </div>
    );
}

function Shine() {
    return (
        <span className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      <span className="absolute -inset-20 opacity-30 rotate-12 bg-[radial-gradient(closest-side,white,transparent)]" />
    </span>
    );
}

function GlitchLine() {
    return (
        <span className="pointer-events-none absolute -bottom-1 left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
    );
}
