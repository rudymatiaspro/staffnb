import { AppProvider, useApp } from '../context/AppContext';
import Login from './Login';
import Dashboard from './Dashboard';

function AppRouter() {
  const { currentUser } = useApp();
  return currentUser ? <Dashboard /> : <Login />;
}

export default function Index() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
