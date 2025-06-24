import { StyleSheet } from 'react-native';
import { ThemeSemanticColors } from '../providers/ThemeProvider';

export const markdownStyles = (colors: ThemeSemanticColors) =>
  StyleSheet.create({
    body: { 
      color: colors.textPrimary, 
      fontSize: 16, 
      lineHeight: 22,
      margin: 0,
      padding: 0
    },
    heading1: { 
      fontSize: 20, 
      fontWeight: '700', 
      marginTop: 16, 
      marginBottom: 8,
      color: colors.textPrimary 
    },
    heading2: { 
      fontSize: 18, 
      fontWeight: '600', 
      marginTop: 12, 
      marginBottom: 6,
      color: colors.textPrimary 
    },
    heading3: { 
      fontSize: 16, 
      fontWeight: '600', 
      marginTop: 10, 
      marginBottom: 4,
      color: colors.textPrimary 
    },
    strong: { 
      fontWeight: '700', 
      color: colors.textPrimary 
    },
    em: { 
      fontStyle: 'italic', 
      color: colors.textPrimary 
    },
    bullet_list: { 
      marginLeft: 6,
      marginVertical: 4
    },
    ordered_list: { 
      marginLeft: 6,
      marginVertical: 4
    },
    list_item: { 
      flexDirection: 'row', 
      marginVertical: 2 
    },
    bullet_list_icon: {
      color: colors.textSecondary,
      marginRight: 6
    },
    ordered_list_icon: {
      color: colors.textSecondary,
      marginRight: 6
    },
    code_inline: {
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: 'monospace',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 14
    },
    code_block: {
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: 'monospace',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      fontSize: 14,
      borderWidth: 1,
      borderColor: colors.border
    },
    blockquote: {
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
      marginVertical: 8
    },
    paragraph: {
      marginVertical: 4
    },
    link: {
      color: colors.accent,
      textDecorationLine: 'underline'
    }
  }); 