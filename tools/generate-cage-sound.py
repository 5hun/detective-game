"""Generate the cage closing sound with Python's standard library.

Run from the repository root: python3 tools/generate-cage-sound.py
The impact at 0.65 s matches jail-gate-close in styles.css.
"""

import math
from pathlib import Path
import random
import struct
import wave

RATE = 44100
DURATION = 1.20
CLOSE = 0.65
# Low steel tuning, without stretching the animation timing.
PITCH = 0.375 * 2 ** (-6 / 12)
rng = random.Random(27)
samples = []
impact_weight = []
low = 0.0
rumble = 0.0
body = 0.0
squeal_phase = 0.0
noise_state = 0.0
# Darken the noise excitation as well as lowering the resonant frequencies.
noise_alpha = 1 - math.exp(-2 * math.pi * 7000 * PITCH / RATE)
# Noise-driven steel resonances: unrelated frequencies avoid a musical tone.
# Each rotating state is a narrow resonant band, excited by rail friction.
steel = []
for frequency, decay, gain in (
    (463, 0.014, 0.13), (997, 0.019, 0.12),
    (1871, 0.011, 0.12), (3127, 0.012, 0.11),
    (4273, 0.009, 0.075), (5819, 0.006, 0.035),
):
    radius = math.exp(-1 / (RATE * decay))
    angle = 2 * math.pi * frequency * PITCH / RATE
    steel.append([radius * math.cos(angle), radius * math.sin(angle),
                  math.sqrt(1 - radius * radius), gain, 0.0, 0.0])
# Uneven wheel joints, distributed across the ease-in/ease-out slide.
joints = (0.08, 0.17, 0.245, 0.31, 0.37, 0.435, 0.515, 0.59)
# Shift the broadband friction's filter cutoffs down with the steel modes.
low_alpha, body_alpha, rumble_alpha = (
    1 - (1 - alpha) ** PITCH for alpha in (0.065, 0.023, 0.009)
)
for i in range(round(RATE * DURATION)):
    t = i / RATE
    noise_state += noise_alpha * (rng.uniform(-1, 1) - noise_state)
    noise = noise_state
    low += low_alpha * (noise - low)
    body += body_alpha * (noise - body)
    rumble += rumble_alpha * (noise - rumble)
    value = 0.0
    if t < CLOSE:
        progress = t / CLOSE
        envelope = min(t / 0.04, 1) * min((CLOSE - t) / 0.018, 1)
        speed = math.sin(math.pi * progress) ** 0.6
        # Dark broadband friction and a deep, irregular rolling vibration.
        grain = 0.7 + 0.18 * math.sin(2 * math.pi * 31 * t) + 0.12 * math.sin(2 * math.pi * 47.3 * t)
        value += 0.75 * envelope * (0.35 + 0.65 * speed) * grain * (
            0.65 * (low - body) + 1.1 * body + 1.0 * rumble
        )
        # Stick-slip friction excites the rails, with bright, ragged edges.
        scrape = 0.0
        excitation = noise * (0.6 + 0.4 * grain)
        for band in steel:
            cosine, sine, drive, gain, real, imaginary = band
            band[4] = cosine * real - sine * imaginary + drive * excitation
            band[5] = sine * real + cosine * imaginary
            scrape += band[4] * gain
        bite = (0.5 + 0.5 * math.sin(2 * math.pi * (83 * t + 9 * math.sin(7 * t)))) ** 5
        value += envelope * (0.5 + 0.5 * speed) * (
            0.85 * scrape * (0.6 + 1.3 * bite) + 0.028 * (noise - low) * grain
        )
        # Intermittent high steel squeaks, with wandering pitch and rough
        # amplitude so they read as friction rather than a sustained whistle.
        squeal_frequency = 2350 + 340 * speed + 85 * math.sin(2 * math.pi * 19.7 * t)
        squeal_phase += 2 * math.pi * squeal_frequency * PITCH / RATE
        squeal_burst = sum(math.exp(-((t - center) / width) ** 2)
                           for center, width in ((0.13, 0.028), (0.32, 0.045), (0.51, 0.032)))
        value += envelope * squeal_burst * (0.65 + 0.35 * grain) * (
            0.09 * math.sin(squeal_phase) + 0.035 * math.sin(squeal_phase * 1.731)
        )
        # Small frame knocks, rather than a bright continuous ringing tone.
        for index, joint in enumerate(joints):
            age = t - joint
            if age >= 0:
                value += envelope * (0.055 + 0.015 * (index % 3)) * math.exp(-age / 0.019) * (
                    math.sin(2 * math.pi * 173 * PITCH * age) + 0.4 * math.sin(2 * math.pi * 431 * PITCH * age)
                )
    dt = t - CLOSE
    weight = 0.0
    if dt >= 0:
        # Brief contact snap over a much longer, bass-heavy frame impact.
        attack = 1 - math.exp(-dt / 0.0005)
        value += attack * (
            0.38 * noise * math.exp(-dt / 0.009)
            + 5.2 * low * math.exp(-dt / 0.065)
            + 10.0 * body * math.exp(-dt / 0.13)
            + 5.0 * rumble * math.exp(-dt / 0.15)
        )
        # Keep the mass of the impact out of the saturator below: clipping
        # these low modes would turn their energy into brighter harmonics.
        weight_attack = 1 - math.exp(-dt / 0.0025)
        for frequency, amplitude, decay in (
            (49, 0.30, 0.13), (79, 0.55, 0.18),
            (121, 0.42, 0.16), (167, 0.28, 0.14),
        ):
            weight += weight_attack * amplitude * math.sin(2 * math.pi * frequency * PITCH * dt) * math.exp(-dt / decay)
        weight += weight_attack * 1.8 * rumble * math.exp(-dt / 0.12)
        for frequency, amplitude, decay in (
            (57, 0.70, 0.12), (98, 0.68, 0.16),
            (143, 0.49, 0.18), (219, 0.43, 0.145),
            (337, 0.34, 0.20), (563, 0.24, 0.17),
            (911, 0.17, 0.14), (1487, 0.11, 0.10),
            (2311, 0.065, 0.065),
        ):
            # Initial bar flex briefly shifts each mode before it settles.
            phase = 2 * math.pi * frequency * PITCH * dt + 0.35 * math.exp(-dt / 0.018)
            value += attack * amplitude * math.cos(phase) * math.exp(-dt / decay)
        # The gate briefly rebounds against its stop.
        rebound = dt - 0.038
        if rebound >= 0:
            value += (0.25 * math.sin(2 * math.pi * 137 * PITCH * rebound) + 1.5 * low) * math.exp(-rebound / 0.045)
    latch = t - (CLOSE + 0.095)
    if latch >= 0:
        value += 0.55 * low * math.exp(-latch / 0.012)
        value += 0.075 * math.sin(2 * math.pi * 583 * PITCH * latch) * math.exp(-latch / 0.04)
    samples.append(value)
    impact_weight.append(weight)

# Short reflections convey a large rigid frame without a long room echo.
dry = samples[:]
for i, value in enumerate(dry):
    for delay, gain in ((0.011, 0.16), (0.023, 0.10), (0.037, 0.065)):
        offset = round(delay * RATE)
        if i >= offset:
            samples[i] += gain * dry[i - offset]
    t = i / RATE
    samples[i] = (math.tanh(samples[i] * 0.85) + impact_weight[i]) * min((DURATION - t) / 0.045, 1)

peak = max(abs(value) for value in samples)
# Normalize before tail damping so the first 70 ms retains its weight.
# Gradually soften the ringing while keeping a short metallic tail.
for i in range(len(samples)):
    tail_age = max(0.0, i / RATE - CLOSE - 0.070)
    samples[i] *= math.exp(-(tail_age / 0.30) ** 1.3)

output = Path(__file__).resolve().parents[1] / 'assets/sounds/cage-close.wav'
with wave.open(str(output), 'wb') as audio:
    audio.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
    audio.writeframes(b''.join(struct.pack('<h', round(value / peak * 0.88 * 32767)) for value in samples))
print(f'{output}: {len(samples) / RATE:.2f} s, impact at {CLOSE:.2f} s')
