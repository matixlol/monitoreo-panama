import { createFileRoute } from '@tanstack/react-router';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { DocumentHeader } from '@/features/document-validation/DocumentHeader';
import { DataPanel } from '@/features/document-validation/DataPanel';
import { PdfPanel } from '@/features/document-validation/PdfPanel';
import { useDocumentValidationData } from '@/features/document-validation/useDocumentValidationData';

export const Route = createFileRoute('/documents_/$documentId')({
  component: DocumentValidationPage,
});

function DocumentValidationPage() {
  const { documentId } = Route.useParams();
  const {
    document,
    validatedData,
    isSaving,
    hasEdits,
    currentPage,
    currentPageIngressRows,
    currentPageEgressRows,
    currentIngress,
    currentEgress,
    ingressDiffs,
    egressDiffs,
    pagesWithDiffs,
    pagesWithUnreadables,
    hasIngressOnPage,
    hasEgressOnPage,
    modelNames,
    extractionsByModel,
    getIngressModelsForRow,
    getEgressModelsForRow,
    handleCellEdit,
    handleAddRow,
    handleDeleteRow,
    handleToggleUnreadable,
    handleSave,
    handleRerunExtraction,
    goToPage,
    handleRotate,
    getCurrentRotation,
    setCurrentPage,
  } = useDocumentValidationData(documentId);

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Cargando documento...</div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
      <DocumentHeader
        documentName={document.name}
        documentStatus={document.status}
        isValidated={Boolean(validatedData)}
        pagesWithDiffs={pagesWithDiffs}
        pagesWithUnreadables={pagesWithUnreadables}
        isSaving={isSaving}
        hasEdits={hasEdits}
        onSave={handleSave}
        onRerunExtraction={handleRerunExtraction}
      />

      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={50} minSize={30}>
          <PdfPanel
            fileUrl={document.fileUrl}
            currentPage={currentPage}
            pageCount={document.pageCount}
            rotation={getCurrentRotation()}
            onPrev={() => setCurrentPage(Math.max(1, currentPage - 1))}
            onNext={() => setCurrentPage(Math.min(document.pageCount, currentPage + 1))}
            onRotate={handleRotate}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={30}>
          <DataPanel
            currentPage={currentPage}
            hasIngressOnPage={hasIngressOnPage}
            hasEgressOnPage={hasEgressOnPage}
            pagesWithDiffs={pagesWithDiffs}
            pagesWithUnreadables={pagesWithUnreadables}
            goToPage={goToPage}
            ingressRows={currentPageIngressRows}
            egressRows={currentPageEgressRows}
            allIngressRows={currentIngress}
            allEgressRows={currentEgress}
            ingressDiffs={ingressDiffs}
            egressDiffs={egressDiffs}
            modelData={extractionsByModel}
            modelNames={modelNames}
            getIngressModelsForRow={getIngressModelsForRow}
            getEgressModelsForRow={getEgressModelsForRow}
            onEditIngress={(rowIndex, field, value) => handleCellEdit('ingress', rowIndex, field, value)}
            onEditEgress={(rowIndex, field, value) => handleCellEdit('egress', rowIndex, field, value)}
            onDeleteIngress={(rowIndex) => handleDeleteRow('ingress', rowIndex)}
            onDeleteEgress={(rowIndex) => handleDeleteRow('egress', rowIndex)}
            onToggleUnreadableIngress={(rowIndex, field) => handleToggleUnreadable('ingress', rowIndex, field)}
            onToggleUnreadableEgress={(rowIndex, field) => handleToggleUnreadable('egress', rowIndex, field)}
            onAddIngress={() => handleAddRow('ingress')}
            onAddEgress={() => handleAddRow('egress')}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
