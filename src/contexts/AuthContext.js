import { createContext } from 'react';

const AuthContext = createContext({
  signIn: async (token, role) => {},
  signOut: async () => {},
  token: null,
  role: null,
});

export default AuthContext;
