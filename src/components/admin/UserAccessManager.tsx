
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { UserRole } from '@/services/api/types';

interface AuthorizedUser {
  email: string;
  role: UserRole;
}

const UserAccessManager: React.FC = () => {
  const { addAuthorizedUser, authorizedUsers, removeAuthorizedUser } = useUser();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('annotator');
  
  const handleAddUser = () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    addAuthorizedUser(email, role);
    setEmail('');
    setRole('annotator');
    toast.success(`Added ${email} as ${role}`);
  };
  
  const handleRemoveUser = (email: string) => {
    removeAuthorizedUser(email);
    toast.success(`Removed ${email} from authorized users`);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage User Access</CardTitle>
        <CardDescription>
          Control which email addresses can log in via Google and their assigned roles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="user@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Role</Label>
              <RadioGroup value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="annotator" id="add-annotator" />
                  <Label htmlFor="add-annotator" className="cursor-pointer">Annotator</Label>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="pod_lead" id="add-pod_lead" />
                  <Label htmlFor="add-pod_lead" className="cursor-pointer">Pod Lead</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="admin" id="add-admin" />
                  <Label htmlFor="add-admin" className="cursor-pointer">Administrator</Label>
                </div>
              </RadioGroup>
            </div>
            
            <Button onClick={handleAddUser} className="w-full">
              Add User
            </Button>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Authorized Users</h3>
            {authorizedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No authorized users added yet</p>
            ) : (
              <div className="space-y-2">
                {authorizedUsers.map((user) => (
                  <div key={user.email} className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                    <div>
                      <span className="font-medium">{user.email}</span>
                      <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        {user.role === 'admin' ? 'Administrator' : 
                         user.role === 'pod_lead' ? 'Pod Lead' : 'Annotator'}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveUser(user.email)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserAccessManager;
