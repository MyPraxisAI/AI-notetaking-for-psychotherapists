import { PageHeader, PageBody } from '@kit/ui/page';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { Skeleton } from '@kit/ui/skeleton';
import { Card, CardContent } from '@kit/ui/card';

export default function Loading() {
  return (
    <>
      <PageHeader 
        description={<AppBreadcrumbs />} 
        title="Personal Invitations"
      >
        <Skeleton className="h-10 w-32" />
      </PageHeader>
      
      <PageBody className="max-w-6xl">
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          
          <div className="space-y-4">
            {Array(5)
              .fill(null)
              .map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              ))}
          </div>

          <div className="mt-6 flex justify-center">
            <Skeleton className="h-10 w-64" />
          </div>
        </CardContent>
      </Card>
      </PageBody>
    </>
  );
}
