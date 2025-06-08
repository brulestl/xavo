import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { SearchBar } from '../components/SearchBar';

const { width: screenWidth } = Dimensions.get('window');

const Drawer = createDrawerNavigator();

interface CustomDrawerContentProps {
  navigation: any;
}

const CustomDrawerContent: React.FC<CustomDrawerContentProps> = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const { user, tier, logout } = useAuth();

  const handleNewSession = () => {
    // Reset chat state and navigate to ChatScreen
    navigation.navigate('Chat');
  };

  const handleChatHistory = () => {
    navigation.navigate('History');
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  return (
    <View style={[styles.drawerContainer, { backgroundColor: isDark ? theme.colors.eerieBlack : theme.colors.alabaster }]}>
      {/* Search Bar */}
      <SearchBar placeholder="Search chats…" />

      <DrawerContentScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Menu Items */}
        <View style={styles.menuSection}>
          <DrawerItem
            label="New Session"
            icon={({ color, size }) => (
              <Ionicons name="add-circle-outline" size={size} color={color} />
            )}
            onPress={handleNewSession}
            labelStyle={{ color: theme.textPrimary, fontSize: 16, fontWeight: '500' }}
            activeTintColor={theme.accent}
          />
          
          <DrawerItem
            label="Chat History"
            icon={({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            )}
            onPress={handleChatHistory}
            labelStyle={{ color: theme.textPrimary, fontSize: 16, fontWeight: '500' }}
            activeTintColor={theme.accent}
          />
        </View>
      </DrawerContentScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={handleSettings}
        >
          <Ionicons name="settings-outline" size={24} color={theme.textSecondary} />
          <Text style={[styles.usernameText, { color: theme.textPrimary }]}>
            {user?.email || 'Guest User'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const DrawerNavigator: React.FC = () => {
  const { theme, isDark } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: isDark ? theme.colors.eerieBlack : theme.colors.alabaster,
          width: screenWidth * 0.75, // 75% width
        },
        drawerType: 'slide',
        overlayColor: 'rgba(0,0,0,0.5)',
      }}
    >
      <Drawer.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{
          title: 'Corporate Influence Coach',
        }}
      />
      <Drawer.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
      <Drawer.Screen 
        name="History" 
        component={HistoryScreen}
        options={{
          title: 'Chat History',
        }}
      />
      <Drawer.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
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
  drawerContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  menuSection: {
    paddingTop: 16,
  },
  bottomSection: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  usernameText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  // Legacy styles (keeping for compatibility)
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