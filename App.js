import React from 'react';
import AuthContext from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import storage from './src/services/storage';

export default function App() {
  const [state, dispatch] = React.useReducer(
    (prevState, action) => {
      switch (action.type) {
        case 'RESTORE_TOKEN':
          return {
            ...prevState,
            userToken: action.token,
            userRole: action.role,
            userId: action.userId,
            isLoading: false,
          };
        case 'SIGN_IN':
          return {
            ...prevState,
            isSignout: false,
            userToken: action.token,
            userRole: action.role,
            userId: action.userId,
          };
        case 'SIGN_OUT':
          return {
            ...prevState,
            isSignout: true,
            userToken: null,
            userRole: null,
            userId: null,
          };
      }
    },
    {
      isLoading: true,
      isSignout: false,
      userToken: null,
      userRole: null,
      userId: null,
    }
  );

  React.useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await storage.getItem('userToken');
        const role = await storage.getItem('userRole');
        const userId = await storage.getItem('userId');
        console.log('Restauration des données utilisateur:', { token: !!token, role, userId });
        dispatch({ type: 'RESTORE_TOKEN', token, role, userId });
      } catch (e) {
        console.error('Erreur lors de la restauration des données utilisateur:', e);
        dispatch({ type: 'RESTORE_TOKEN', token: null, role: null, userId: null });
      }
    };

    bootstrapAsync();
  }, []);

  const authContext = React.useMemo(
    () => ({
      signIn: async (token, role, userId) => {
        await storage.setItem('userToken', token);
        await storage.setItem('userRole', role);
        if (userId) {
          await storage.setItem('userId', userId.toString());
          console.log(`ID utilisateur ${userId} enregistré dans le contexte d'authentification`);
        }
        dispatch({ type: 'SIGN_IN', token, role, userId });
      },
      signOut: async () => {
        await storage.removeItem('userToken');
        await storage.removeItem('userRole');
        await storage.removeItem('userId');
        dispatch({ type: 'SIGN_OUT' });
      },
      token: state.userToken,
      role: state.userRole,
      userId: state.userId,
    }),
    [state.userToken, state.userRole, state.userId]
  );

  return (
    <AuthContext.Provider value={authContext}>
      <AppNavigator />
    </AuthContext.Provider>
  );
}
