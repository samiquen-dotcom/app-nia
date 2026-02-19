import React, { useState } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { PeriodData } from '../types';

const SYMPTOMS = ['Cólicos', 'Hinchazón', 'Sensible', 'Antojos', 'Energía baja', 'Acné'];

const todayStr = () => new Date().toISOString().split('T')[0];

const diffDays = (from: string, to: string) => {
    const a = new Date(from + 'T00:00:00');
    const b = new Date(to   + 'T00:00:00');
    return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
};

const getPhase = (startDate: string, cycleLength: number, periodLength: number) => {
    const diff  = diffDays(startDate, todayStr());
    const day   = (diff % cycleLength) + 1;
    if (day <= periodLength)  return { name: 'Menstrual 🩸', desc: 'Período activo. Descansa y cuídate mucho.', day };
    if (day <= 13)             return { name: 'Folicular 🌱', desc: 'Tu energía va aumentando. ¡Buen momento!', day };
    if (day === 14)            return { name: 'Ovulación 🌸', desc: 'Pico de energía y fertilidad hoy.', day };
    return                          { name: 'Lútea 🌿',     desc: `Día ${day} del ciclo. Escucha a tu cuerpo.`, day };
};

export const PeriodScreen: React.FC = () => {
    const { data, save } = useFeatureData<PeriodData>('period', {
        cycleStartDate: '',
        cycleLength:    28,
        periodLength:   5,
        symptomsLog:    {},
    });

    const [showModal, setShowModal] = useState(false);
    const [inputDate, setInputDate]   = useState('');
    const [inputCycle, setInputCycle] = useState(28);
    const [inputPeriod, setInputPeriod] = useState(5);

    const today        = todayStr();
    const todaySymptoms = data.symptomsLog[today] || [];
    const phase = data.cycleStartDate ? getPhase(data.cycleStartDate, data.cycleLength, data.periodLength) : null;

    const openModal = () => {
        setInputDate(data.cycleStartDate || today);
        setInputCycle(data.cycleLength);
        setInputPeriod(data.periodLength);
        setShowModal(true);
    };

    const saveCycle = async () => {
        if (!inputDate) return;
        await save({
            cycleStartDate: inputDate,
            cycleLength:    inputCycle,
            periodLength:   inputPeriod,
        });
        setShowModal(false);
    };

    const toggleSymptom = async (s: string) => {
        const current = data.symptomsLog[today] || [];
        const updated = current.includes(s)
            ? current.filter(i => i !== s)
            : [...current, s];
        await save({ symptomsLog: { ...data.symptomsLog, [today]: updated } });
    };

    // ─── Calendar ──────────────────────────────────────────────────────────────
    const now        = new Date();
    const year       = now.getFullYear();
    const month      = now.getMonth();
    const monthName  = now.toLocaleDateString('es-ES', { month: 'long' });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rawFirstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const startOffset = rawFirstDay === 0 ? 6 : rawFirstDay - 1; // shift to Mon start

    const dayClass = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (dateStr === today) return 'bg-slate-800 text-white shadow-lg scale-110 z-10';
        if (!data.cycleStartDate) return 'hover:bg-gray-50 text-slate-600 dark:text-slate-300 dark:hover:bg-[#3a2028]';

        const diff        = diffDays(data.cycleStartDate, dateStr);
        const dayInCycle  = (diff % data.cycleLength) + 1;
        if (diff < 0) return 'text-slate-300 dark:text-slate-600';
        if (dayInCycle >= 1 && dayInCycle <= data.periodLength) return 'bg-rose-200 text-rose-700 font-bold';
        if (dayInCycle >= 11 && dayInCycle <= 17)               return 'bg-teal-100 text-teal-600 font-bold';
        return 'hover:bg-gray-50 text-slate-600 dark:text-slate-300 dark:hover:bg-[#3a2028]';
    };

    return (
        <div className="p-6 pt-12 pb-24">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Tu ciclo, Nia 🌙</h1>
                <button
                    onClick={openModal}
                    className="text-xs bg-pink-100 text-pink-500 font-bold px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-pink-200 transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">edit_calendar</span>
                    {data.cycleStartDate ? 'Editar ciclo' : 'Iniciar ciclo'}
                </button>
            </div>

            {/* ── Modal ────────────────────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-[#2d1820] rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1">¿Cuándo inició tu período?</h2>
                        <p className="text-xs text-slate-400 mb-4">Selecciona el primer día de sangrado.</p>

                        <input
                            type="date"
                            value={inputDate}
                            onChange={e => setInputDate(e.target.value)}
                            className="w-full border border-slate-200 dark:border-[#5a2b35] dark:bg-[#3a2028] dark:text-slate-100 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-pink-400"
                        />

                        <div className="flex gap-3 mb-5">
                            <label className="flex-1">
                                <p className="text-xs text-slate-400 mb-1 text-center">Días del ciclo</p>
                                <input
                                    type="number"
                                    value={inputCycle}
                                    min={21} max={40}
                                    onChange={e => setInputCycle(Number(e.target.value))}
                                    className="w-full border border-slate-200 dark:border-[#5a2b35] dark:bg-[#3a2028] dark:text-slate-100 rounded-xl px-3 py-2 text-center focus:outline-none focus:border-pink-400"
                                />
                            </label>
                            <label className="flex-1">
                                <p className="text-xs text-slate-400 mb-1 text-center">Días de período</p>
                                <input
                                    type="number"
                                    value={inputPeriod}
                                    min={2} max={10}
                                    onChange={e => setInputPeriod(Number(e.target.value))}
                                    className="w-full border border-slate-200 dark:border-[#5a2b35] dark:bg-[#3a2028] dark:text-slate-100 rounded-xl px-3 py-2 text-center focus:outline-none focus:border-pink-400"
                                />
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 dark:bg-[#3a2028] text-slate-500 dark:text-slate-300 py-3 rounded-xl font-bold text-sm">
                                Cancelar
                            </button>
                            <button onClick={saveCycle} className="flex-1 bg-pink-500 text-white py-3 rounded-xl font-bold text-sm">
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Phase Card ───────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-[#2d1820] dark:to-[#3a2028] rounded-3xl p-6 mb-6 border border-pink-100 dark:border-[#5a2b35]/40">
                {phase ? (
                    <>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="bg-white/80 dark:bg-white/10 p-2 rounded-full text-pink-400 shadow-sm">
                                <span className="material-symbols-outlined">female</span>
                            </span>
                            <span className="text-pink-400 font-bold uppercase tracking-wider text-xs">Hoy · Día {phase.day}</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight mb-1">Fase {phase.name}</h2>
                        <p className="text-slate-500 dark:text-slate-300 text-sm">{phase.desc}</p>
                    </>
                ) : (
                    <div className="text-center py-2">
                        <p className="text-slate-500 dark:text-slate-300 text-sm mb-3">
                            Registra tu ciclo para ver tu fase actual y tu calendario personalizado.
                        </p>
                        <button
                            onClick={openModal}
                            className="bg-pink-500 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-pink-600 transition-colors"
                        >
                            Registrar inicio del ciclo
                        </button>
                    </div>
                )}
            </div>

            {/* ── Calendar ─────────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#2d1820] rounded-3xl p-4 shadow-sm border border-slate-100 dark:border-[#5a2b35]/30 mb-6">
                <div className="flex justify-between mb-4 px-2">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 capitalize">{monthName}</h3>
                    <span className="text-slate-400 text-sm">{year}</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-slate-400 font-medium">
                    {['L','M','M','J','V','S','D'].map((d, i) => <span key={i}>{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                        <div
                            key={d}
                            className={`aspect-square rounded-full flex items-center justify-center text-xs cursor-pointer transition-all ${dayClass(d)}`}
                        >
                            {d}
                        </div>
                    ))}
                </div>
                <div className="flex gap-4 mt-4 justify-center text-[10px] text-slate-400">
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-300 inline-block"></span> Periodo</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-200 inline-block"></span> Fértil</div>
                </div>
            </div>

            {/* ── Symptoms ─────────────────────────────────────────────────────── */}
            <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3">Síntomas de hoy</h3>
                <div className="flex flex-wrap gap-2">
                    {SYMPTOMS.map(s => (
                        <button
                            key={s}
                            onClick={() => toggleSymptom(s)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all
                                ${todaySymptoms.includes(s)
                                    ? 'bg-primary text-text-main shadow-md'
                                    : 'bg-white dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 text-slate-500 dark:text-slate-300'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
                {todaySymptoms.length > 0 ? (
                    <p className="text-xs text-pink-400 mt-2 ml-1 font-medium">
                        {todaySymptoms.length} síntoma{todaySymptoms.length > 1 ? 's' : ''} registrado{todaySymptoms.length > 1 ? 's' : ''} hoy ✓
                    </p>
                ) : (
                    <p className="text-xs text-slate-400 mt-2 ml-1">Selecciona cómo te sientes, Nia.</p>
                )}
            </div>
        </div>
    );
};
