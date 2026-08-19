import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { bffClient } from "@/api/bffClient";
import { DocumentSummary } from "@/models/Domain";

export default function Documents() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);

  useEffect(() => {
    bffClient.getDocuments().then(setDocuments);
  }, []);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground">Statements and documents generated for your account</p>
        </div>
        <FileText className="h-8 w-8 text-primary" />
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground">Generated Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{doc.title}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{doc.documentType}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {doc.generatedAt ? new Date(doc.generatedAt).toLocaleDateString() : "--"}
                </p>
              </div>
            ))}
            {documents.length === 0 && (
              <p className="text-muted-foreground">
                No documents yet — ask the AI assistant to generate an account statement.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
