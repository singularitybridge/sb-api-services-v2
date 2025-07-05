# Custom Authentication Implementation Research

## Executive Summary

This document outlines a comprehensive research and implementation plan for introducing a custom authentication system to complement the existing Google OAuth-only authentication in the sb-api-services-v2 platform. The goal is to enable native user registration and login capabilities while maintaining backward compatibility with the current Google OAuth flow.

## Current State Analysis

### Overview
The sb-api-services-v2 platform is a multi-tenant SaaS system that currently relies exclusively on Google OAuth for user authentication. While this provides a secure and frictionless user experience, it creates limitations for:
- Users without Google accounts
- Enterprise customers requiring custom identity providers
- API-first integrations that need programmatic user creation
- Scenarios where Google services are unavailable or restricted

### Existing Authentication Architecture

#### 1. **Authentication Flow**
- **Primary**: Google OAuth 2.0 with ID token verification
- **Secondary**: API Key authentication for programmatic access
- **Session Management**: JWT tokens with 7-day expiration
- **No Password System**: Zero password storage or management infrastructure

#### 2. **Data Models**
- **User Model**: Contains googleId but no password field
- **Company Model**: Auto-created for each new user
- **Session Model**: Tracks active user sessions with assistants
- **ApiKey Model**: Provides programmatic access with SHA-256 hashed keys

#### 3. **Security Infrastructure**
- JWT token generation and validation
- Role-based access control (Admin/CompanyUser)
- Company-based data isolation
- Encryption for sensitive data (API keys, tokens)
- Rate limiting for API key authentication

#### 4. **Key Services**
- `googleAuth.service.ts`: Handles Google OAuth flow
- `token.service.ts`: JWT token management
- `session.service.ts`: User session lifecycle
- `apiKey.service.ts`: API key generation and validation

## Proposed Solution Architecture

### 1. **Hybrid Authentication System**
Implement a flexible authentication system that supports multiple authentication methods:
- **Native Authentication**: Email/password registration and login
- **Google OAuth**: Maintain existing Google sign-in flow
- **Future Extensibility**: Support for SAML, OAuth2, OIDC providers

### 2. **Database Schema Updates**

#### User Model Extensions
```typescript
interface IUserExtended extends IUser {
  // Existing fields remain unchanged
  
  // New authentication fields
  authProviders: {
    google?: {
      id: string;
      email: string;
      linkedAt: Date;
    };
    native?: {
      passwordHash: string;
      passwordSalt: string;
      passwordResetToken?: string;
      passwordResetExpires?: Date;
      emailVerified: boolean;
      emailVerificationToken?: string;
      lastPasswordChange: Date;
    };
  };
  
  // Security features
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  loginAttempts: number;
  lockoutUntil?: Date;
  lastLoginAt?: Date;
  lastLoginIp?: string;
}
```

#### New AuthLog Model
```typescript
interface IAuthLog {
  userId: Types.ObjectId;
  action: 'login' | 'logout' | 'password_reset' | 'password_change' | 'email_verification';
  method: 'native' | 'google' | 'api_key';
  ip: string;
  userAgent: string;
  success: boolean;
  reason?: string;
  timestamp: Date;
}
```

### 3. **Implementation Phases**

#### Phase 1: Core Infrastructure (Week 1-2)
1. Update User model with authentication fields
2. Create password hashing service (bcrypt/argon2)
3. Implement registration endpoint
4. Build login endpoint with JWT generation
5. Add password reset flow
6. Create email verification system

#### Phase 2: Security Enhancements (Week 3)
1. Implement rate limiting for auth endpoints
2. Add brute force protection
3. Create password complexity validator
4. Build account lockout mechanism
5. Add authentication logging
6. Implement CSRF protection

#### Phase 3: User Experience (Week 4)
1. Email templates for verification/reset
2. Account settings API for password changes
3. Session management endpoints
4. "Remember me" functionality
5. Device tracking and management

#### Phase 4: Migration & Integration (Week 5)
1. Create migration scripts for existing users
2. Update middleware to support both auth methods
3. Modify existing services for compatibility
4. Update API documentation
5. Create admin tools for user management

## Technical Considerations

### 1. **Security Best Practices**
- **Password Storage**: Use Argon2id or bcrypt with appropriate cost factor
- **Token Security**: Implement secure random token generation
- **Rate Limiting**: Prevent brute force attacks on login endpoints
- **Input Validation**: Strict validation for email and password inputs
- **HTTPS Only**: Enforce TLS for all authentication endpoints
- **Security Headers**: Implement HSTS, CSP, X-Frame-Options

### 2. **Backward Compatibility**
- Existing Google OAuth flow remains unchanged
- JWT token structure stays compatible
- API key authentication continues to work
- No breaking changes to existing endpoints

### 3. **Migration Strategy**
- **Soft Launch**: Enable native auth for new users first
- **Gradual Migration**: Allow existing users to set passwords
- **Dual Auth**: Support linking Google and native accounts
- **No Forced Migration**: Google-only users can continue as-is

### 4. **Performance Considerations**
- Index email fields for fast lookups
- Cache authentication results where appropriate
- Optimize password hashing parameters
- Consider read replicas for auth queries

## Risk Analysis

### 1. **Security Risks**
- **Password Breaches**: Mitigated by strong hashing and complexity requirements
- **Account Takeover**: Prevented by rate limiting and account lockout
- **Email Spoofing**: Addressed by email verification requirement
- **Token Hijacking**: Minimized by short expiration and secure transmission

### 2. **Operational Risks**
- **Email Deliverability**: Requires reliable email service provider
- **Support Burden**: Password resets and account recovery requests
- **Compliance**: GDPR, CCPA considerations for storing passwords
- **Migration Errors**: Careful testing and rollback plan needed

### 3. **Technical Risks**
- **Breaking Changes**: Mitigated by comprehensive testing
- **Performance Impact**: Monitor authentication endpoint latency
- **Database Migration**: Plan for zero-downtime updates
- **Integration Complexity**: Phased rollout reduces risk

## Implementation Recommendations

### 1. **Technology Choices**
- **Password Hashing**: Argon2id (preferred) or bcrypt
- **Email Service**: SendGrid, AWS SES, or existing provider
- **Validation**: Joi or Yup for input validation
- **Rate Limiting**: Extend existing rate limit middleware

### 2. **Development Approach**
- Feature flags for gradual rollout
- Comprehensive unit and integration tests
- Load testing for authentication endpoints
- Security audit before production deployment

### 3. **Monitoring & Metrics**
- Track authentication success/failure rates
- Monitor password reset requests
- Alert on suspicious login patterns
- Dashboard for authentication analytics

## Success Criteria

1. **Functional Requirements**
   - Users can register with email/password
   - Existing Google users unaffected
   - Password reset flow works reliably
   - Email verification implemented

2. **Performance Requirements**
   - Login response time < 200ms
   - Registration response time < 500ms
   - No degradation of existing auth performance

3. **Security Requirements**
   - Pass security audit
   - No plaintext password storage
   - Proper rate limiting in place
   - Account lockout functioning

4. **User Experience**
   - Clear error messages
   - Intuitive password requirements
   - Smooth migration for existing users
   - Mobile-friendly authentication flow

## Next Steps

1. **Stakeholder Approval**: Review and approve implementation plan
2. **Technical Design**: Create detailed API specifications
3. **Security Review**: Conduct threat modeling session
4. **Resource Allocation**: Assign development team
5. **Timeline Finalization**: Set sprint milestones
6. **Testing Strategy**: Define test cases and scenarios

## Conclusion

Implementing a custom authentication system alongside Google OAuth will significantly enhance the platform's flexibility and accessibility. By following a phased approach with strong security practices and careful attention to backward compatibility, we can deliver a robust solution that meets diverse user needs while maintaining the system's integrity and performance.