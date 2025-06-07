import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';

const Drawer = createDrawerNavigator();

interface CustomDrawerContentProps {
  navigation: any;
}

const CustomDrawerContent: React.FC<CustomDrawerContentProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { user, tier, dailyQueryCount, logout } = useAuth();

  const getQueriesDisplay = () => {
    if (tier === 'power') return 'Unlimited';
    return `${dailyQueryCount}/3 used today`;
  };

  const handleNavigation = (screenName: string) => {
    navigation.navigate(screenName);
  };

  return (
    <DrawerContentScrollView style={{ backgroundColor: theme.screenBackground }}>
      {/* Header */}
      <View style={[styles.drawerHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Image
          source={require('../../media/logo/logo_platinum_67.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        
        {user ? (
          <View style={styles.userInfo}>
            <Text style={[styles.userEmail, { color: theme.textPrimary }]}>
              {user.email}
            </Text>
            <View style={[styles.tierBadge, { backgroundColor: theme.accent }]}>
              <Text style={[styles.tierText, { color: theme.colors.eerieBlack }]}>
                {tier.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.queriesText, { color: theme.textSecondary }]}>
              {getQueriesDisplay()}
            </Text>
          </View>
        ) : (
          <View style={styles.guestInfo}>
            <Text style={[styles.guestText, { color: theme.textPrimary }]}>
              Guest User
            </Text>
            <Text style={[styles.queriesText, { color: theme.textSecondary }]}>
              {getQueriesDisplay()}
            </Text>
          </View>
        )}
      </View>

      {/* Navigation Items */}
      <View style={styles.navigationSection}>
        {user ? (
          <>
            <DrawerItem
              label="Relationships"
              icon={({ color, size }) => (
                <Ionicons name="chatbubbles-outline" size={size} color={color} />
              )}
              onPress={() => handleNavigation('Dashboard')}
              labelStyle={{ color: theme.textPrimary }}
              activeBackgroundColor={theme.cardBackground}
              activeTintColor={theme.accent}
            />
            
            <DrawerItem
              label="Account"
              icon={({ color, size }) => (
                <Ionicons name="person-outline" size={size} color={color} />
              )}
              onPress={() => handleNavigation('Account')}
              labelStyle={{ color: theme.textPrimary }}
              activeBackgroundColor={theme.cardBackground}
              activeTintColor={theme.accent}
            />
          </>
        ) : (
          <>
            <DrawerItem
              label="Relationships"
              icon={({ color, size }) => (
                <Ionicons name="chatbubbles-outline" size={size} color={color} />
              )}
              onPress={() => handleNavigation('Dashboard')}
              labelStyle={{ color: theme.textPrimary }}
              activeBackgroundColor={theme.cardBackground}
              activeTintColor={theme.accent}
            />
            
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
            
            <DrawerItem
              label="Log In"
              icon={({ color, size }) => (
                <Ionicons name="log-in-outline" size={size} color={color} />
              )}
              onPress={() => handleNavigation('AuthChoice')}
              labelStyle={{ color: theme.accent }}
              activeTintColor={theme.accent}
            />
            
            <DrawerItem
              label="Sign Up"
              icon={({ color, size }) => (
                <Ionicons name="person-add-outline" size={size} color={color} />
              )}
              onPress={() => navigation.navigate('LoginSignup', { mode: 'signup' })}
              labelStyle={{ color: theme.accent }}
              activeTintColor={theme.accent}
            />
          </>
        )}
      </View>

      {/* Footer */}
      {user && (
        <View style={styles.drawerFooter}>
          <TouchableOpacity
            style={[styles.logoutButton, { borderColor: theme.border }]}
            onPress={logout}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.logoutText, { color: theme.textSecondary }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </DrawerContentScrollView>
  );
};

export const DrawerNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        },
        headerTintColor: theme.textPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        drawerStyle: {
          backgroundColor: theme.screenBackground,
        },
      }}
    >
      <Drawer.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Relationship Coach',
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <Image
                source={require('../../media/logo/logo_platinum_67.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>
          ),
        }}
      />
      <Drawer.Screen 
        name="Account" 
        component={AccountScreen}
        options={{
          title: 'Account',
        }}
      />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  drawerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 16,
  },
  userInfo: {
    marginTop: 8,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  tierText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  queriesText: {
    fontSize: 12,
    marginTop: 4,
  },
  guestInfo: {
    marginTop: 8,
  },
  guestText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  navigationSection: {
    flex: 1,
  },
  separator: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 16,
  },
  headerLeft: {
    marginLeft: 16,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
}); 