# zenTab

A minimalistic focus extension that blocks distracting websites during focus sessions.

## Features

-   Block distracting websites to stay focused.
-   Simple interface to manage your blocklist.
-   Start and stop focus sessions as needed.

## Demo

[Watch a demo of zenTab on YouTube](https://www.youtube.com/watch?v=DBN8uIBm8hM)

## Getting Started

### Prerequisites

-   Node.js and npm (or a compatible package manager)

### Installation & Development

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd zentab
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npm run dev
    ```
    This will create a `dist` directory with the unpacked extension.

4.  **Load the extension in your browser:**
    -   **Chrome:** Go to `chrome://extensions`, enable "Developer mode", and click "Load unpacked" to select the `dist` directory.
    -   **Firefox:** Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on...", and select the `dist/manifest.json` file.

### Building for Production

To build the extension for production, run:

```bash
npm run build
```

This will create a production-ready build in the `dist` directory.

To create a zip file for submission to web stores, run:

```bash
npm run zip
```

This will generate a `.zip` file in the project root. 