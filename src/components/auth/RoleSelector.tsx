
import React from 'react';
import { useUser } from '@/contexts/UserContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/services/api/types';

interface RoleSelectorProps {
  onRoleSelected?: () => void;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ onRoleSelected }) => {
  const { user, setUserRole } = useUser();
  const [selectedRole, setSelectedRole] = React.useState<UserRole>(user?.role || 'annotator');
  
  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserRole(selectedRole);
    if (onRoleSelected) onRoleSelected();
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Your Role</CardTitle>
        <CardDescription>
          Please select your role in the annotation system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <RadioGroup 
            defaultValue={selectedRole}
            onValueChange={(value) => handleRoleChange(value as UserRole)}
          >
            <div className="flex items-center space-x-2 mb-3">
              <RadioGroupItem value="annotator" id="annotator" />
              <Label htmlFor="annotator" className="cursor-pointer">Annotator</Label>
            </div>
            <div className="flex items-center space-x-2 mb-3">
              <RadioGroupItem value="pod_lead" id="pod_lead" />
              <Label htmlFor="pod_lead" className="cursor-pointer">Pod Lead</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="admin" id="admin" />
              <Label htmlFor="admin" className="cursor-pointer">Administrator</Label>
            </div>
          </RadioGroup>
          
          <Button type="submit" className="w-full">
            Confirm Role
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RoleSelector;
