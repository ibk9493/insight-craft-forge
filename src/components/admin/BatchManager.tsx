
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Trash2, Eye, Filter, PackagePlus, Calendar, Package } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { api, BatchUpload } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs-wrapper';

const BatchManager: React.FC = () => {
  const [batches, setBatches] = useState<BatchUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchUpload | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Load batches from API
  const fetchBatches = async () => {
    setLoading(true);
    try {
      const fetchedBatches = await api.batches.getAllBatches();
      setBatches(fetchedBatches);
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to load batch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  // Delete batch handler
  const handleDeleteBatch = async (batchId: number) => {
    if (window.confirm('Are you sure you want to delete this batch?')) {
      try {
        const result = await api.batches.deleteBatch(batchId);
        if (result.success) {
          toast.success('Batch deleted successfully');
          // Refresh the batch list
          fetchBatches();
        } else {
          toast.error(result.message || 'Failed to delete batch');
        }
      } catch (error) {
        console.error('Error deleting batch:', error);
        toast.error('An error occurred while deleting the batch');
      }
    }
  };

  // View batch details
  const handleViewBatchDetails = (batch: BatchUpload) => {
    setSelectedBatch(batch);
    setIsDetailOpen(true);
  };

  // Filter batches based on search term
  const filteredBatches = batches.filter(batch => 
    batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (batch.description && batch.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                Batch Management
              </CardTitle>
              <CardDescription>
                Manage upload batches and track discussion imports
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Filter className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-500" />
                <Input
                  placeholder="Search batches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[250px]"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-8 border rounded-md border-dashed">
                <PackagePlus className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No batches found</h3>
                <p className="text-sm text-gray-500">
                  Upload a new batch of discussions using the uploader tab.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Discussions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.name}</TableCell>
                        <TableCell>{batch.description || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Calendar className="mr-1 h-3 w-3 text-gray-500" />
                            <span>{format(new Date(batch.created_at), 'MMM d, yyyy')}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{batch.discussion_count}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewBatchDetails(batch)}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View</span>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteBatch(batch.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Batch Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Batch Details</DialogTitle>
            <DialogDescription>
              View information about this upload batch
            </DialogDescription>
          </DialogHeader>

          {selectedBatch && (
            <div className="space-y-6">
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Name</Label>
                  <div className="col-span-3">
                    <p className="font-medium">{selectedBatch.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Description</Label>
                  <div className="col-span-3">
                    <p>{selectedBatch.description || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Created</Label>
                  <div className="col-span-3">
                    <p>{format(new Date(selectedBatch.created_at), 'PPP p')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Created By</Label>
                  <div className="col-span-3">
                    <p>{selectedBatch.created_by || 'Unknown'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Discussions</Label>
                  <div className="col-span-3">
                    <Badge>{selectedBatch.discussion_count}</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BatchManager;
