import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export type Tier = 'guest' | 'essential' | 'power';

export interface AuthUser {
  id: string;
  email: string;
  tier: Tier;
  dailyQueryCount?: number;
}

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || 
      'https://wdhmlynmbrhunizbdhdt.supabase.co';
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY') || 
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkaG1seW5tYnJodW5pemJkaGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMDQ2NjgsImV4cCI6MjA2NDg4MDY2OH0.ORKN6Ryiz4Yo_BFhE_CS2yHMGPJDncKtYWKTwwI98N4';

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async validateToken(token: string): Promise<AuthUser> {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);
      
      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      const tier = this.getTierForUser(user);
      
      return {
        id: user.id,
        email: user.email || '',
        tier,
      };
    } catch (error) {
      throw new UnauthorizedException('Token validation failed');
    }
  }

  private getTierForUser(user: User): Tier {
    // Simple tier logic based on email
    // In production, this would query a database
    if (user.email?.includes('power')) {
      return 'power';
    }
    return 'essential';
  }

  async canMakeQuery(userId: string, tier: Tier): Promise<boolean> {
    if (tier === 'power') {
      return true;
    }

    // For essential tier, check daily query limit
    // This would typically query a database to get actual count
    // For now, we'll assume they can make queries (frontend handles limits)
    return true;
  }

  extractTokenFromHeader(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    
    return authHeader.substring(7);
  }
} 