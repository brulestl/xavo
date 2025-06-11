import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../../contexts/AuthContext';
import { SearchBar } from '../components/SearchBar';

const { width: screenWidth } = Dimensions.get('window');

const Drawer = createDrawerNavigator();

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const { theme, isDark } = useTheme();
  const { email, logout } = useAuth();

  const handleNewSession = () => {
    props.navigation.navigate('Chat');
    props.navigation.closeDrawer();
  };

  const handleChatHistory = () => {
    props.navigation.navigate('History');
    props.navigation.closeDrawer();
  };

  const handleSettings = () => {
    props.navigation.navigate('Settings');
    props.navigation.closeDrawer();
  };

  return (
    <View style={[styles.drawerContainer, { backgroundColor: theme.semanticColors.background }]}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollContent}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <SearchBar placeholder="Search chats..." />
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={handleNewSession}>
            <Ionicons 
              name="add-circle-outline" 
              size={24} 
              color={theme.semanticColors.textPrimary} 
            />
            <Text style={[styles.menuText, { color: theme.semanticColors.textPrimary }]}>
              New Session
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleChatHistory}>
            <Ionicons 
              name="time-outline" 
              size={24} 
              color={theme.semanticColors.textPrimary} 
            />
            <Text style={[styles.menuText, { color: theme.semanticColors.textPrimary }]}>
              Chat History
            </Text>
          </TouchableOpacity>
        </View>
      </DrawerContentScrollView>

      {/* Bottom Section */}
      <View style={[styles.bottomSection, { borderTopColor: theme.semanticColors.border }]}>
        <TouchableOpacity style={styles.settingsRow} onPress={handleSettings}>
          <View style={styles.userInfo}>
            <Ionicons 
              name="settings-outline" 
              size={24} 
              color={theme.semanticColors.textSecondary} 
            />
            <Text style={[styles.username, { color: theme.semanticColors.textSecondary }]}>
              {email || 'Guest User'}
            </Text>
          </View>
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={theme.semanticColors.textSecondary} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const DrawerNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: '75%', // 75% screen width as specified
          backgroundColor: theme.semanticColors.background,
        },
        drawerType: 'slide',
        overlayColor: 'rgba(0,0,0,0.5)',
        sceneContainerStyle: {
          backgroundColor: theme.semanticColors.background,
        },
      }}
    >
      <Drawer.Screen name="Chat" component={ChatScreen} />
      <Drawer.Screen name="History" component={HistoryScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
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
  scrollContent: {
    flexGrow: 1,
    paddingTop: 20,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  menuSection: {
    paddingHorizontal: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14, // Tightened spacing
    borderRadius: 8,
    marginBottom: 4,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500', // Improved font weight
    marginLeft: 12,
  },
  bottomSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
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