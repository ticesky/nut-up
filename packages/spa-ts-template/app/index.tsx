import ReactDOM from 'react-dom/client';
import App from 'modules/App';

const root = ReactDOM.createRoot(
    document.getElementById('wrap') as HTMLElement
);

root.render(<App />);