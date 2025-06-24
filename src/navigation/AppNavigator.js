import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import AuthContext from '../contexts/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import TeacherNavigator from './TeacherNavigator';
import ParentNavigator from './ParentNavigator';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { token, role } = React.useContext(AuthContext);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token == null ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            {role === 'enseignant' && (
              <Stack.Screen name="TeacherApp" component={TeacherNavigator} />
            )}
            {role === 'parent' && (
              <Stack.Screen name="ParentApp" component={ParentNavigator} />
            )}
            {!['enseignant', 'parent'].includes(role) && (
              <Stack.Screen name="Login" component={LoginScreen} />
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
