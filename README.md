# Thumbnail Counter

Editable counter dashboard inspired by the supplied corkboard reference.

## Main features

- Add, edit, duplicate and delete counters
- Increase or decrease each counter
- Change names, goals, current values and accent colors
- Drag counters freely across the entire browser screen in **Edit mode**
- Counter positions are saved automatically in the browser
- **Reset all** removes every counter from the screen
- Export and import the dashboard as JSON
- Responsive layout for desktop and mobile

## Project structure

```text
thumbnail-counter/
├── index.html
├── manifest.webmanifest
├── README.md
├── assets/
│   └── favicon.svg
├── css/
│   └── styles.css
└── js/
    └── app.js
```

## Testing in VS Code

1. Open the extracted `thumbnail-counter` folder in VS Code.
2. Install the **Live Server** extension.
3. Open `index.html`.
4. Click **Go Live** or choose **Open with Live Server**.
5. In the site, click **Edit mode** and drag a counter by its dark upper area.

You can also use Python from the VS Code terminal:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Important after updating

Use `Ctrl + F5` in the browser to force a full refresh. Existing saved counter positions are automatically migrated to the full-screen coordinate system.

## Correção de arraste próxima ao cabeçalho

As áreas transparentes do cabeçalho e da linha de status não bloqueiam mais o mouse. Somente o título e os botões visíveis recebem cliques, e o contador ativo passa visualmente sobre o cabeçalho durante o arraste.

- A logo `assets/logo-jl.svg` é exibida centralizada no fundo como marca d’água.


## Position persistence

Counter positions are stored as relative viewport coordinates. A counter placed on the right side remains on the right after refreshing or resizing the browser window.
