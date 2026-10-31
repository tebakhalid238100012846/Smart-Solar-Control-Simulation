# Smart Solar Control — Interactive Website

A standalone, browser-based educational simulation of the combined solar tracking and DC voltage stabilization project.

## Run locally

1. Keep `index.html`, `style.css`, and `app.js` in the same folder.
2. Open `index.html` in a modern browser while connected to the internet (Chart.js is loaded from a CDN).
3. Change the simulation parameters and select **Start simulation**.

No Python, Google Colab, backend, or server is required for the simulation calculations.

## Publish a public website with GitHub Pages

1. Create a new **public** GitHub repository, for example `Smart-Solar-Control-Simulation`.
2. Upload the three files in this folder to the repository root (not inside another folder).
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select branch **main** and folder **/(root)**, then press **Save**.
6. Wait for GitHub Pages to publish. The URL will look like:
   `https://YOUR-USERNAME.github.io/Smart-Solar-Control-Simulation/`

## Model assumptions

- Solar panel rated power: 100 W at 1000 W/m².
- Nominal PV voltage: 18 V; PV current is represented as `Ipv = Ppv / 18` implicitly through the power balance model.
- Effective irradiance: `Geff = G × max(cos(θsun − θpanel), 0)`.
- A 2 W motor consumption is deducted while the tracking motor is moving.
- Solar tracking is a proportional angle controller with motor speed limits.
- Voltage regulation uses a PI controller with feedforward, duty saturation (0.05–0.95), and conditional anti-windup.
- Buck converter averaged CCM equations: `L diL/dt = D·Vsrc − Vout − rL·iL`; `C dVout/dt = iL − Vout/Rload`.
- L = 10 mH, C = 1000 µF, rL = 0.15 Ω, converter efficiency for the reported output power capacity = 90%.
- PV source voltage is reduced when requested input power exceeds available PV net power. This is a simplified source-power limit, not a detailed PV I–V model.
- Time step: 5 ms. The model is educational and averaged, not switching-level or hardware-validated.
- No MPPT algorithm is included. Sun tracking and MPPT are different functions.
- A Buck converter steps down voltage only; keep Vref below the 18 V nominal PV voltage.

## Controls and outputs

Inputs: duration, irradiance, start/end sun angle, cloud time/drop, voltage reference, load before/after/change time, PI Kp and Ki.

Outputs: tracking angle, tracking error, irradiance, PV/load power, output voltage, duty ratio, summary metrics, and CSV export.

## Files

- `index.html` — page structure and interface.
- `style.css` — responsive visual design.
- `app.js` — simulation model, controls, charts, presets, and CSV export.
